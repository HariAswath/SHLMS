import { db } from "../db/db.js";
import { schedules, holidays, laundryGroups, users } from "../db/schema.js";
import { eq, and, gte, lte, asc, desc } from "drizzle-orm";
import { AppError } from "../utils/AppError.js";
import {
  generateRoundRobinSchedules,
  shiftFutureSchedulesOnHoliday,
} from "../utils/scheduler.js";
import { resolveGroupByRoom } from "../utils/groupResolver.js";

// ==========================================
// 1. Generate Schedules (Admin Only)
// ==========================================
export const generateSchedule = async (req, res, next) => {
  try {
    const { startDate, endDate, hostelId, startTime, endTime } = req.body;

    const result = await generateRoundRobinSchedules({
      startDate,
      endDate,
      hostelId,
      adminId: req.user.id,
      startTime,
      endTime,
    });

    return res.status(201).json({
      success: true,
      message: `Successfully generated ${result.totalGenerated} round-robin schedules`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. Get Schedules (With Range & Status Filters)
// ==========================================
export const getSchedules = async (req, res, next) => {
  try {
    const { startDate, endDate, groupId, status, limit = 50 } = req.query;

    const conditions = [];

    if (startDate) {
      conditions.push(gte(schedules.scheduleDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(schedules.scheduleDate, endDate));
    }
    if (groupId) {
      conditions.push(eq(schedules.groupId, parseInt(groupId, 10)));
    }
    if (status) {
      conditions.push(eq(schedules.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const scheduleList = await db.query.schedules.findMany({
      where: whereClause,
      limit: Math.min(100, Math.max(1, Number(limit) || 50)),
      orderBy: [asc(schedules.scheduleDate)],
      with: {
        group: {
          with: {
            hostel: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Schedules retrieved successfully",
      data: {
        schedules: scheduleList,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. Get Today's Schedule (All Roles)
// ==========================================
export const getTodaySchedule = async (req, res, next) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];

    // Check if today is a Holiday
    const [todayHoliday] = await db
      .select()
      .from(holidays)
      .where(eq(holidays.date, todayStr))
      .limit(1);

    if (todayHoliday) {
      return res.status(200).json({
        success: true,
        message: "Today is a holiday",
        data: {
          date: todayStr,
          isHoliday: true,
          holiday: todayHoliday,
          schedule: null,
        },
      });
    }

    // Check today's schedule
    const todaySchedule = await db.query.schedules.findFirst({
      where: eq(schedules.scheduleDate, todayStr),
      with: {
        group: {
          with: {
            hostel: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: todaySchedule
        ? "Today's schedule retrieved successfully"
        : "No laundry scheduled for today",
      data: {
        date: todayStr,
        isHoliday: false,
        schedule: todaySchedule || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. Get Student's Assigned Schedule (Student Role)
// ==========================================
export const getMySchedule = async (req, res, next) => {
  try {
    const studentUser = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
      with: {
        room: true,
        hostel: true,
      },
    });

    if (!studentUser || studentUser.role !== "student") {
      throw new AppError("Only student accounts have an assigned laundry schedule", 403);
    }

    if (!studentUser.hostelId || !studentUser.room?.roomNumber) {
      return res.status(200).json({
        success: true,
        message: "Student room assignment is pending",
        data: {
          assignedGroup: null,
          isScheduledToday: false,
          nextScheduleDate: null,
          upcomingSchedules: [],
        },
      });
    }

    // Resolve student's group
    const studentGroup = await resolveGroupByRoom(
      studentUser.hostelId,
      studentUser.room.roomNumber
    );

    if (!studentGroup) {
      return res.status(200).json({
        success: true,
        message: "No active laundry group covers this room",
        data: {
          assignedGroup: null,
          isScheduledToday: false,
          nextScheduleDate: null,
          upcomingSchedules: [],
        },
      });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Check if scheduled today
    const [todaySched] = await db
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.groupId, studentGroup.id),
          eq(schedules.scheduleDate, todayStr),
          eq(schedules.status, "scheduled")
        )
      )
      .limit(1);

    // Fetch upcoming schedules for this student's group
    const upcoming = await db.query.schedules.findMany({
      where: and(
        eq(schedules.groupId, studentGroup.id),
        gte(schedules.scheduleDate, todayStr)
      ),
      limit: 10,
      orderBy: [asc(schedules.scheduleDate)],
    });

    return res.status(200).json({
      success: true,
      message: "Student schedule retrieved successfully",
      data: {
        student: {
          id: studentUser.id,
          name: studentUser.name,
          studentId: studentUser.studentId,
          room: studentUser.room.roomNumber,
          barcodeValue: studentUser.barcodeValue,
        },
        assignedGroup: studentGroup,
        isScheduledToday: Boolean(todaySched),
        nextScheduleDate: upcoming.length > 0 ? upcoming[0].scheduleDate : null,
        upcomingSchedules: upcoming,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. Get Upcoming Schedules (Next N Days)
// ==========================================
export const getUpcomingSchedules = async (req, res, next) => {
  try {
    const days = Math.min(60, Math.max(1, Number(req.query.days) || 14));
    const todayStr = new Date().toISOString().split("T")[0];

    const endDateObj = new Date();
    endDateObj.setUTCDate(endDateObj.getUTCDate() + days);
    const endDateStr = endDateObj.toISOString().split("T")[0];

    // Schedules in range
    const upcomingSchedules = await db.query.schedules.findMany({
      where: and(
        gte(schedules.scheduleDate, todayStr),
        lte(schedules.scheduleDate, endDateStr)
      ),
      orderBy: [asc(schedules.scheduleDate)],
      with: {
        group: {
          with: {
            hostel: true,
          },
        },
      },
    });

    // Holidays in range
    const upcomingHolidays = await db
      .select()
      .from(holidays)
      .where(and(gte(holidays.date, todayStr), lte(holidays.date, endDateStr)))
      .orderBy(asc(holidays.date));

    return res.status(200).json({
      success: true,
      message: `Upcoming schedules for the next ${days} days retrieved`,
      data: {
        dateRange: { start: todayStr, end: endDateStr, days },
        schedules: upcomingSchedules,
        holidays: upcomingHolidays,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 6. Admin Correction for a Schedule (Rule 21)
// ==========================================
export const patchSchedule = async (req, res, next) => {
  try {
    const scheduleId = parseInt(req.params.id, 10);
    if (isNaN(scheduleId)) {
      throw new AppError("Invalid schedule ID parameter", 400);
    }

    const [existing] = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, scheduleId))
      .limit(1);

    if (!existing) {
      throw new AppError("Schedule record not found", 404);
    }

    const { groupId, startTime, endTime, status } = req.body;

    const updateData = {
      updatedAt: new Date(),
    };

    if (groupId !== undefined) updateData.groupId = groupId;
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (status !== undefined) updateData.status = status;

    const [updated] = await db
      .update(schedules)
      .set(updateData)
      .where(eq(schedules.id, scheduleId))
      .returning();

    return res.status(200).json({
      success: true,
      message: "Schedule updated successfully",
      data: {
        schedule: updated,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 7. Create Holiday (With Optional Auto-Shift)
// ==========================================
export const createHoliday = async (req, res, next) => {
  try {
    const { date, reason, shiftFutureSchedules = true } = req.body;

    // Check unique holiday date
    const existing = await db
      .select({ id: holidays.id })
      .from(holidays)
      .where(eq(holidays.date, date))
      .limit(1);

    if (existing.length > 0) {
      throw new AppError(`Holiday for date '${date}' already exists`, 409);
    }

    const [newHoliday] = await db
      .insert(holidays)
      .values({
        date,
        reason: reason.trim(),
        createdBy: req.user.id,
      })
      .returning();

    let shiftResult = null;
    if (shiftFutureSchedules) {
      shiftResult = await shiftFutureSchedulesOnHoliday(date, req.user.id);
    }

    return res.status(201).json({
      success: true,
      message: "Holiday created successfully",
      data: {
        holiday: newHoliday,
        shiftResult,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 8. Get Holidays List
// ==========================================
export const getHolidays = async (req, res, next) => {
  try {
    const holidayList = await db
      .select()
      .from(holidays)
      .orderBy(asc(holidays.date));

    return res.status(200).json({
      success: true,
      message: "Holidays retrieved successfully",
      data: {
        holidays: holidayList,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 9. Update Holiday
// ==========================================
export const updateHoliday = async (req, res, next) => {
  try {
    const holidayId = parseInt(req.params.id, 10);
    if (isNaN(holidayId)) {
      throw new AppError("Invalid holiday ID parameter", 400);
    }

    const [existing] = await db
      .select()
      .from(holidays)
      .where(eq(holidays.id, holidayId))
      .limit(1);

    if (!existing) {
      throw new AppError("Holiday record not found", 404);
    }

    const { date, reason } = req.body;
    const updateData = {};

    if (reason !== undefined) updateData.reason = reason.trim();
    if (date !== undefined && date !== existing.date) {
      const duplicate = await db
        .select({ id: holidays.id })
        .from(holidays)
        .where(eq(holidays.date, date))
        .limit(1);
      if (duplicate.length > 0) {
        throw new AppError(`A holiday on date '${date}' already exists`, 409);
      }
      updateData.date = date;
    }

    const [updated] = await db
      .update(holidays)
      .set(updateData)
      .where(eq(holidays.id, holidayId))
      .returning();

    return res.status(200).json({
      success: true,
      message: "Holiday updated successfully",
      data: {
        holiday: updated,
      },
    });
  } catch (error) {
    next(error);
  }
};
