import { db } from "../db/db.js";
import { laundryGroups } from "../db/schema.js";
import { eq, and, asc } from "drizzle-orm";

/**
 * Deterministically resolves which laundry group a room belongs to in a hostel.
 *
 * @param {number} hostelId - The ID of the hostel
 * @param {string|number} roomNumber - The student's room number (e.g. "105" or "D-105")
 * @returns {Promise<Object|null>} The matching laundry group, or null if not in any defined group.
 */
export const resolveGroupByRoom = async (hostelId, roomNumber) => {
  if (!hostelId || !roomNumber) return null;

  // Fetch all active groups for the hostel, ordered by groupOrder
  const groups = await db
    .select()
    .from(laundryGroups)
    .where(and(eq(laundryGroups.hostelId, hostelId), eq(laundryGroups.status, "active")))
    .orderBy(asc(laundryGroups.groupOrder));

  if (groups.length === 0) return null;

  const rawRoomStr = String(roomNumber).trim();
  const numericRoom = parseInt(rawRoomStr, 10);
  const isNumeric = !isNaN(numericRoom);

  for (const group of groups) {
    if (!group.roomRangeStart || !group.roomRangeEnd) continue;

    const startStr = group.roomRangeStart.trim();
    const endStr = group.roomRangeEnd.trim();
    const startNum = parseInt(startStr, 10);
    const endNum = parseInt(endStr, 10);

    // 1. If both group boundaries and the room number are numeric (e.g. 101 to 233 and room 105)
    if (isNumeric && !isNaN(startNum) && !isNaN(endNum)) {
      if (numericRoom >= startNum && numericRoom <= endNum) {
        return group;
      }
    } else {
      // 2. Fallback to alphanumeric string comparison
      if (rawRoomStr.localeCompare(startStr) >= 0 && rawRoomStr.localeCompare(endStr) <= 0) {
        return group;
      }
    }
  }

  return null;
};

export default { resolveGroupByRoom };
