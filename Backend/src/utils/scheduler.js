import { db } from "../db/db.js";
import { schedules, holidays, laundryGroups } from "../db/schema.js";
import { eq, and, asc, desc, lte, gte, lt, not } from "drizzle-orm";
import { AppError } from "./AppError.js";

/**
 * Returns an array of YYYY-MM-DD date strings between start and end date (inclusive).
 */
export const getDateRange = (startDateStr, endDateStr) => {
  const dates = [];
  const curr = new Date(`${startDateStr}T00:00:00Z`);
  const end = new Date(`${endDateStr}T00:00:00Z`);

  while (curr <= end) {
    dates.push(curr.toISOString().split("T")[0]);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
};

/**
 * Core Round-Robin Schedule Generation Algorithm.
 * Assigns next working laundry day to the next group in rotation.
 * Holidays FREEZE the rotation index.
 *
 * @param {Object} params
 * @param {string} params.startDate - YYYY-MM-DD
 * @param {string} params.endDate - YYYY-MM-DD
 * @param {number} [params.hostelId] - Optional hostel filter (default: 1st active hostel)
 * @param {number} params.adminId - Admin user ID creating schedule
 * @param {string} [params.startTime="08:00"]
 * @param {string} [params.endTime="18:00"]
 */
export const generateRoundRobinSchedules = async ({
  startDate,
  endDate,
  hostelId,
  adminId,
  startTime = "08:00",
  endTime = "18:00",
}) => {
  // 1. Fetch active laundry groups
  const groupQueryCondition = hostelId
    ? and(eq(laundryGroups.hostelId, hostelId), eq(laundryGroups.status, "active"))
    : eq(laundryGroups.status, "active");

  const groups = await db
    .select()
    .from(laundryGroups)
    .where(groupQueryCondition)
    .orderBy(asc(laundryGroups.groupOrder));

  if (groups.length === 0) {
    throw new AppError("No active laundry groups found. Please configure groups first.", 400);
  }

  // 2. Fetch all holidays
  const allHolidays = await db.select({ date: holidays.date }).from(holidays);
  const holidaySet = new Set(allHolidays.map((h) => h.date));

  // 3. Determine starting rotationIndex
  // Look up the last valid schedule before startDate to continue rotation seamlessly
  const lastSchedule = await db
    .select({
      scheduleDate: schedules.scheduleDate,
      rotationPosition: schedules.rotationPosition,
    })
    .from(schedules)
    .where(and(lt(schedules.scheduleDate, startDate), not(eq(schedules.status, "cancelled"))))
    .orderBy(desc(schedules.scheduleDate))
    .limit(1);

  let rotationIndex = 0;
  if (lastSchedule.length > 0 && typeof lastSchedule[0].rotationPosition === "number") {
    rotationIndex = (lastSchedule[0].rotationPosition + 1) % groups.length;
  }

  // 4. Generate day by day
  const dateList = getDateRange(startDate, endDate);
  const generatedSchedules = [];

  for (const dateStr of dateList) {
    // If today is a Holiday: freeze rotation (do not advance rotationIndex)
    if (holidaySet.has(dateStr)) {
      continue;
    }

    // Check if an untouched schedule already exists on this date
    const existing = await db
      .select({ id: schedules.id, status: schedules.status })
      .from(schedules)
      .where(eq(schedules.scheduleDate, dateStr))
      .limit(1);

    // If already completed or active, do not overwrite silently (Rule 21)
    if (existing.length > 0 && existing[0].status === "completed") {
      continue;
    }

    const targetGroup = groups[rotationIndex];

    if (existing.length > 0) {
      // Update existing future schedule
      const [updated] = await db
        .update(schedules)
        .set({
          groupId: targetGroup.id,
          startTime,
          endTime,
          rotationPosition: rotationIndex,
          status: "scheduled",
          updatedAt: new Date(),
        })
        .where(eq(schedules.id, existing[0].id))
        .returning();

      generatedSchedules.push(updated);
    } else {
      // Insert new schedule
      const [inserted] = await db
        .insert(schedules)
        .values({
          scheduleDate: dateStr,
          groupId: targetGroup.id,
          startTime,
          endTime,
          rotationPosition: rotationIndex,
          status: "scheduled",
          createdBy: adminId,
        })
        .returning();

      generatedSchedules.push(inserted);
    }

    // Advance rotation ONLY on working laundry days
    rotationIndex = (rotationIndex + 1) % groups.length;
  }

  return {
    totalGenerated: generatedSchedules.length,
    schedules: generatedSchedules,
  };
};

/**
 * Automatically shifts future schedules when an unexpected holiday is added.
 * Ensures the group waiting on that holiday gets the very next working day.
 */
export const shiftFutureSchedulesOnHoliday = async (holidayDateStr, adminId) => {
  // 1. Check if there are future uncompleted schedules on or after holidayDateStr
  const futureSchedules = await db
    .select({
      scheduleDate: schedules.scheduleDate,
    })
    .from(schedules)
    .where(and(gte(schedules.scheduleDate, holidayDateStr), eq(schedules.status, "scheduled")))
    .orderBy(desc(schedules.scheduleDate))
    .limit(1);

  if (futureSchedules.length === 0) {
    return { shifted: false };
  }

  const latestDate = futureSchedules[0].scheduleDate;

  // Extend 1 day forward to accommodate the shifted day
  const latestDateObj = new Date(`${latestDate}T00:00:00Z`);
  latestDateObj.setUTCDate(latestDateObj.getUTCDate() + 1);
  const newEndDate = latestDateObj.toISOString().split("T")[0];

  // Re-run the round-robin generator starting from the holiday date to newEndDate
  const res = await generateRoundRobinSchedules({
    startDate: holidayDateStr,
    endDate: newEndDate,
    adminId,
  });

  return {
    shifted: true,
    shiftedCount: res.totalGenerated,
  };
};

export default {
  getDateRange,
  generateRoundRobinSchedules,
  shiftFutureSchedulesOnHoliday,
};
