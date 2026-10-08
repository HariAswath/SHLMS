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
    if (!group.roomRangeStart) continue;

    const startStr = group.roomRangeStart.trim();
    const endStr = group.roomRangeEnd ? group.roomRangeEnd.trim() : startStr;

    // 1. Check comma/space separated list of room numbers
    if (startStr.includes(",") || endStr.includes(",")) {
      const roomList = `${startStr},${endStr}`
        .split(/[, ]+/)
        .map((r) => r.trim())
        .filter(Boolean);
      if (roomList.includes(rawRoomStr)) {
        return group;
      }
    }

    // 2. Direct exact match
    if (rawRoomStr === startStr || rawRoomStr === endStr) {
      return group;
    }

    const startNum = parseInt(startStr, 10);
    const endNum = parseInt(endStr, 10);

    // 3. Numeric range check
    if (isNumeric && !isNaN(startNum) && !isNaN(endNum)) {
      const min = Math.min(startNum, endNum);
      const max = Math.max(startNum, endNum);
      if (numericRoom >= min && numericRoom <= max) {
        return group;
      }
    } else {
      // 4. Fallback to alphanumeric string comparison
      if (rawRoomStr.localeCompare(startStr) >= 0 && rawRoomStr.localeCompare(endStr) <= 0) {
        return group;
      }
    }
  }

  return null;
};

export default { resolveGroupByRoom };
