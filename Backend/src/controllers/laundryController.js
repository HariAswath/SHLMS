import { db } from "../db/db.js";
import {
  laundryRecords,
  schedules,
  holidays,
  users,
  laundryGroups,
  notifications,
  rooms,
} from "../db/schema.js";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { AppError } from "../utils/AppError.js";
import { resolveGroupByRoom } from "../utils/groupResolver.js";

// ==========================================
// 1. Verify Submission (Staff Scans Student QR)
// ==========================================
export const verifySubmission = async (req, res, next) => {
  try {
    const { barcodeValue, date } = req.body;
    const todayStr = date || new Date().toISOString().split("T")[0];

    // 1. Find student
    const student = await db.query.users.findFirst({
      where: eq(users.barcodeValue, barcodeValue.trim()),
      with: {
        hostel: true,
        floor: true,
        room: true,
      },
    });

    if (!student || student.role !== "student") {
      throw new AppError("Student with this QR/barcode not found", 404);
    }

    // 2. Check active status
    if (student.status !== "active") {
      throw new AppError("Student account is inactive. Please contact administration.", 403);
    }

    if (!student.hostelId || !student.room?.roomNumber) {
      throw new AppError("Student has no hostel room assignment on file", 400);
    }

    // 3. Resolve student's group
    const studentGroup = await resolveGroupByRoom(
      student.hostelId,
      student.room.roomNumber
    );

    if (!studentGroup) {
      throw new AppError("Student's room is not assigned to any active laundry group", 400);
    }

    // 4. Check if today is a Holiday
    const [todayHoliday] = await db
      .select()
      .from(holidays)
      .where(eq(holidays.date, todayStr))
      .limit(1);

    if (todayHoliday) {
      throw new AppError(
        `Today is marked as a holiday (${todayHoliday.reason}). No laundry collection today.`,
        409
      );
    }

    // 5. Fetch today's schedule
    const todaySchedule = await db.query.schedules.findFirst({
      where: and(eq(schedules.scheduleDate, todayStr), eq(schedules.status, "scheduled")),
      with: {
        group: true,
      },
    });

    if (!todaySchedule) {
      throw new AppError("No laundry service is scheduled for today", 409);
    }

    // 6. Compare assigned group against today's scheduled group
    if (todaySchedule.groupId !== studentGroup.id) {
      throw new AppError(
        `Student is not scheduled today. Student belongs to '${studentGroup.name}', but today is scheduled for '${todaySchedule.group.name}'.`,
        409
      );
    }

    // 7. Check duplicate submission for today
    const existingSubmission = await db
      .select({ id: laundryRecords.id, status: laundryRecords.status })
      .from(laundryRecords)
      .where(
        and(
          eq(laundryRecords.studentId, student.id),
          eq(laundryRecords.scheduleId, todaySchedule.id)
        )
      )
      .limit(1);

    if (existingSubmission.length > 0) {
      throw new AppError("Student has already submitted laundry for today's schedule", 409);
    }

    return res.status(200).json({
      success: true,
      message: "Student is verified and eligible for laundry submission today",
      data: {
        eligible: true,
        student: {
          id: student.id,
          name: student.name,
          studentId: student.studentId,
          barcodeValue: student.barcodeValue,
          hostel: student.hostel?.name,
          room: student.room?.roomNumber,
        },
        assignedGroup: studentGroup,
        todaySchedule: {
          id: todaySchedule.id,
          scheduleDate: todaySchedule.scheduleDate,
          startTime: todaySchedule.startTime,
          endTime: todaySchedule.endTime,
          groupName: todaySchedule.group.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. Submit Laundry (Critical Transaction - Staff Only)
// ==========================================
export const submitLaundry = async (req, res, next) => {
  try {
    const { barcodeValue, clothDetails, date } = req.body;
    const staffId = req.user.id;
    const todayStr = date || new Date().toISOString().split("T")[0];

    // Execute within database transaction
    const result = await db.transaction(async (tx) => {
      // 1. Find student
      const [student] = await tx
        .select()
        .from(users)
        .where(eq(users.barcodeValue, barcodeValue.trim()))
        .limit(1);

      if (!student || student.role !== "student") {
        throw new AppError("Student with this QR/barcode not found", 404);
      }

      if (student.status !== "active") {
        throw new AppError("Student account is inactive", 403);
      }

      // 2. Find student room
      const [studentRoom] = await tx
        .select({ roomNumber: rooms.roomNumber })
        .from(rooms)
        .where(eq(rooms.id, student.roomId))
        .limit(1);

      if (!student.hostelId || !studentRoom?.roomNumber) {
        throw new AppError("Student room assignment is missing", 400);
      }

      // 3. Resolve group
      const studentGroup = await resolveGroupByRoom(
        student.hostelId,
        studentRoom.roomNumber
      );

      if (!studentGroup) {
        throw new AppError("Student room is not mapped to any laundry group", 400);
      }

      // 4. Find today's schedule
      const [todaySchedule] = await tx
        .select()
        .from(schedules)
        .where(
          and(
            eq(schedules.scheduleDate, todayStr),
            eq(schedules.status, "scheduled")
          )
        )
        .limit(1);

      if (!todaySchedule) {
        throw new AppError("No laundry service is scheduled for today", 409);
      }

      // 5. Match group
      if (todaySchedule.groupId !== studentGroup.id) {
        throw new AppError("Student is not scheduled for laundry today", 409);
      }

      // 6. Check duplicate submission
      const existing = await tx
        .select({ id: laundryRecords.id })
        .from(laundryRecords)
        .where(
          and(
            eq(laundryRecords.studentId, student.id),
            eq(laundryRecords.scheduleId, todaySchedule.id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new AppError("Student has already submitted laundry for today's schedule", 409);
      }

      // 7. Create laundry record
      const [record] = await tx
        .insert(laundryRecords)
        .values({
          studentId: student.id,
          scheduleId: todaySchedule.id,
          submittedByStaffId: staffId,
          status: "received",
          clothDetails,
          submittedAt: new Date(),
        })
        .returning();

      // 8. Create notification for student
      await tx.insert(notifications).values({
        userId: student.id,
        type: "laundry_received",
        title: "Laundry Received",
        message: `Your laundry has been received by staff and recorded with ${Object.keys(clothDetails).length} cloth categories. Status: Received.`,
      });

      return record;
    });

    return res.status(201).json({
      success: true,
      message: "Laundry submitted successfully",
      data: {
        laundryRecord: result,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. Get Today's Queue & Statistics (Staff & Admin)
// ==========================================
export const getTodayQueue = async (req, res, next) => {
  try {
    const todayStr = req.query.date || new Date().toISOString().split("T")[0];

    // Find today's schedule
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

    if (!todaySchedule) {
      return res.status(200).json({
        success: true,
        message: "No active laundry schedule for today",
        data: {
          schedule: null,
          statistics: {
            expectedStudents: 0,
            submitted: 0,
            pending: 0,
            received: 0,
            readyForPickup: 0,
            delivered: 0,
          },
          queue: [],
        },
      });
    }

    // Fetch all laundry records submitted for today's schedule
    const todayRecords = await db.query.laundryRecords.findMany({
      where: eq(laundryRecords.scheduleId, todaySchedule.id),
      orderBy: [asc(laundryRecords.submittedAt)],
      with: {
        student: {
          with: {
            room: true,
            floor: true,
            hostel: true,
          },
        },
        staff: {
          columns: { id: true, name: true },
        },
      },
    });

    // Compute stats
    let received = 0;
    let readyForPickup = 0;
    let delivered = 0;

    for (const rec of todayRecords) {
      if (rec.status === "received") received++;
      else if (rec.status === "ready_for_pickup") readyForPickup++;
      else if (rec.status === "delivered") delivered++;
    }

    const submitted = todayRecords.length;

    // Approximate expected students count from group range
    const startNum = parseInt(todaySchedule.group.roomRangeStart, 10);
    const endNum = parseInt(todaySchedule.group.roomRangeEnd, 10);
    const totalRoomsInGroup = !isNaN(startNum) && !isNaN(endNum) ? endNum - startNum + 1 : 15;
    const expectedStudents = totalRoomsInGroup * 2; // Assuming ~2 students per room estimate
    const pending = Math.max(0, expectedStudents - submitted);

    return res.status(200).json({
      success: true,
      message: "Today's queue retrieved successfully",
      data: {
        schedule: todaySchedule,
        statistics: {
          expectedStudents,
          submitted,
          pending,
          received,
          readyForPickup,
          delivered,
        },
        queue: todayRecords,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. Get Student's Laundry History (Student Role)
// ==========================================
export const getMyLaundry = async (req, res, next) => {
  try {
    const studentRecords = await db.query.laundryRecords.findMany({
      where: eq(laundryRecords.studentId, req.user.id),
      orderBy: [desc(laundryRecords.createdAt)],
      with: {
        schedule: {
          with: {
            group: true,
          },
        },
        staff: {
          columns: { id: true, name: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Laundry history retrieved successfully",
      data: {
        records: studentRecords,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. Get Laundry Record By ID
// ==========================================
export const getLaundryById = async (req, res, next) => {
  try {
    const recordId = parseInt(req.params.id, 10);
    if (isNaN(recordId)) {
      throw new AppError("Invalid laundry ID parameter", 400);
    }

    const record = await db.query.laundryRecords.findFirst({
      where: eq(laundryRecords.id, recordId),
      with: {
        student: {
          with: {
            room: true,
            floor: true,
            hostel: true,
          },
        },
        staff: {
          columns: { id: true, name: true },
        },
        schedule: {
          with: {
            group: true,
          },
        },
        complaints: true,
        feedback: true,
      },
    });

    if (!record) {
      throw new AppError("Laundry record not found", 404);
    }

    // Role check: Student can only view their own laundry
    if (req.user.role === "student" && record.studentId !== req.user.id) {
      throw new AppError("Forbidden: You are not authorized to view another student's laundry", 403);
    }

    return res.status(200).json({
      success: true,
      message: "Laundry record retrieved successfully",
      data: {
        record,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 6. Update Laundry Status (Staff & Admin - Transition Guard)
// ==========================================
export const updateLaundryStatus = async (req, res, next) => {
  try {
    const recordId = parseInt(req.params.id, 10);
    if (isNaN(recordId)) {
      throw new AppError("Invalid laundry ID parameter", 400);
    }

    const { status: targetStatus } = req.body;

    const [record] = await db
      .select()
      .from(laundryRecords)
      .where(eq(laundryRecords.id, recordId))
      .limit(1);

    if (!record) {
      throw new AppError("Laundry record not found", 404);
    }

    const currentStatus = record.status;

    // Transition Guard (Section 28)
    // Allowed: received -> ready_for_pickup -> delivered
    // Disallowed: backward transitions
    if (currentStatus === "delivered" && targetStatus !== "delivered") {
      throw new AppError(
        "Invalid status transition: Delivered laundry cannot be reverted to any prior status",
        400
      );
    }

    if (currentStatus === "ready_for_pickup" && targetStatus === "received") {
      throw new AppError(
        "Invalid status transition: Laundry ready for pickup cannot be reverted to received",
        400
      );
    }

    const updateData = {
      status: targetStatus,
      updatedAt: new Date(),
    };

    if (targetStatus === "ready_for_pickup" && !record.readyAt) {
      updateData.readyAt = new Date();
    }

    if (targetStatus === "delivered" && !record.deliveredAt) {
      updateData.deliveredAt = new Date();
    }

    const [updatedRecord] = await db
      .update(laundryRecords)
      .set(updateData)
      .where(eq(laundryRecords.id, recordId))
      .returning();

    // Trigger status update notification
    if (targetStatus === "ready_for_pickup") {
      await db.insert(notifications).values({
        userId: record.studentId,
        type: "laundry_ready",
        title: "Laundry Ready for Pickup",
        message: "Your laundry has been washed and dried. It is ready for collection at the laundry counter!",
      });
    } else if (targetStatus === "delivered") {
      await db.insert(notifications).values({
        userId: record.studentId,
        type: "laundry_delivered",
        title: "Laundry Delivered",
        message: "Your laundry has been marked as delivered. Please share your feedback with us!",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Laundry status updated to '${targetStatus}'`,
      data: {
        record: updatedRecord,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 7. Verify Pickup and Deliver (QR Verification - Staff & Admin)
// ==========================================
export const verifyPickupAndDeliver = async (req, res, next) => {
  try {
    const { barcodeValue } = req.body;
    const rawId = req.params?.id;

    // 1. Find the scanned student by barcode
    const [scannedStudent] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.barcodeValue, barcodeValue.trim()))
      .limit(1);

    if (!scannedStudent) {
      throw new AppError("Scanned QR/barcode does not match any registered student", 404);
    }

    let record;

    if (rawId) {
      const recordId = parseInt(rawId, 10);
      if (isNaN(recordId)) {
        throw new AppError("Invalid laundry ID parameter", 400);
      }

      // 2. Find specified laundry record
      [record] = await db
        .select()
        .from(laundryRecords)
        .where(eq(laundryRecords.id, recordId))
        .limit(1);

      if (!record) {
        throw new AppError("Laundry record not found", 404);
      }

      // 3. Ownership Verification (Section 15)
      if (record.studentId !== scannedStudent.id) {
        throw new AppError(
          "Verification Failed: This laundry record belongs to another student!",
          409
        );
      }
    } else {
      // Direct QR Scan lookup: find student's active laundry record ready for pickup
      const studentRecords = await db
        .select()
        .from(laundryRecords)
        .where(eq(laundryRecords.studentId, scannedStudent.id))
        .orderBy(desc(laundryRecords.createdAt));

      if (studentRecords.length === 0) {
        throw new AppError("No laundry records found for this student", 404);
      }

      const readyRecord = studentRecords.find((r) => r.status === "ready_for_pickup");
      if (!readyRecord) {
        const receivedRecord = studentRecords.find((r) => r.status === "received");
        if (receivedRecord) {
          throw new AppError(
            "This student's laundry is currently being processed and is not ready for pickup yet",
            409
          );
        }
        throw new AppError(
          "All previous laundry submissions for this student have already been delivered",
          409
        );
      }

      record = readyRecord;
    }

    // 4. Status Check
    if (record.status === "delivered") {
      throw new AppError("This laundry has already been delivered to the student", 409);
    }

    if (record.status !== "ready_for_pickup") {
      throw new AppError(
        `This laundry is not ready for pickup yet (current status: '${record.status}')`,
        409
      );
    }

    // 5. Mark delivered atomically
    const now = new Date();
    const [deliveredRecord] = await db
      .update(laundryRecords)
      .set({
        status: "delivered",
        deliveredAt: now,
        pickupVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(laundryRecords.id, record.id))
      .returning();

    // 6. Notify student
    await db.insert(notifications).values({
      userId: record.studentId,
      type: "laundry_delivered",
      title: "Laundry Delivered",
      message: "Your QR code was verified at the counter and laundry has been successfully handed over.",
    });

    return res.status(200).json({
      success: true,
      message: "Pickup verified successfully! Laundry marked as delivered.",
      data: {
        record: deliveredRecord,
      },
    });
  } catch (error) {
    next(error);
  }
};
