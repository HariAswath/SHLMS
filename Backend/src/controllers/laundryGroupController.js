import { db } from "../db/db.js";
import { laundryGroups, hostels } from "../db/schema.js";
import { eq, and, asc } from "drizzle-orm";
import { AppError } from "../utils/AppError.js";
import { resolveGroupByRoom } from "../utils/groupResolver.js";

// ==========================================
// 1. Create Laundry Group (Admin Only)
// ==========================================
export const createLaundryGroup = async (req, res, next) => {
  try {
    const {
      hostelId,
      name,
      groupOrder,
      roomRangeStart,
      roomRangeEnd,
      status = "active",
    } = req.body;

    // Verify hostel exists
    const [hostel] = await db
      .select({ id: hostels.id })
      .from(hostels)
      .where(eq(hostels.id, hostelId))
      .limit(1);

    if (!hostel) {
      throw new AppError("Referenced hostel does not exist", 404);
    }

    // Check duplicate groupOrder in same hostel
    const existingOrder = await db
      .select({ id: laundryGroups.id })
      .from(laundryGroups)
      .where(
        and(
          eq(laundryGroups.hostelId, hostelId),
          eq(laundryGroups.groupOrder, groupOrder)
        )
      )
      .limit(1);

    if (existingOrder.length > 0) {
      throw new AppError(
        `A group with order #${groupOrder} already exists in this hostel`,
        409
      );
    }

    const [newGroup] = await db
      .insert(laundryGroups)
      .values({
        hostelId,
        name: name.trim(),
        groupOrder,
        roomRangeStart: roomRangeStart.trim(),
        roomRangeEnd: roomRangeEnd.trim(),
        status,
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Laundry group created successfully",
      data: {
        group: newGroup,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. Get All Laundry Groups (Authenticated)
// ==========================================
export const getLaundryGroups = async (req, res, next) => {
  try {
    const { hostelId, status } = req.query;

    const conditions = [];
    if (hostelId) {
      conditions.push(eq(laundryGroups.hostelId, parseInt(hostelId, 10)));
    }
    if (status) {
      conditions.push(eq(laundryGroups.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const groups = await db.query.laundryGroups.findMany({
      where: whereClause,
      orderBy: [asc(laundryGroups.groupOrder)],
      with: {
        hostel: {
          columns: { id: true, name: true, code: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Laundry groups retrieved successfully",
      data: {
        groups,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. Get Laundry Group By ID
// ==========================================
export const getLaundryGroupById = async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) {
      throw new AppError("Invalid laundry group ID parameter", 400);
    }

    const group = await db.query.laundryGroups.findFirst({
      where: eq(laundryGroups.id, groupId),
      with: {
        hostel: true,
        schedules: {
          limit: 10,
          orderBy: (schedules, { desc }) => [desc(schedules.scheduleDate)],
        },
      },
    });

    if (!group) {
      throw new AppError("Laundry group not found", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Laundry group retrieved successfully",
      data: {
        group,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. Update Laundry Group (Admin Only)
// ==========================================
export const updateLaundryGroup = async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) {
      throw new AppError("Invalid laundry group ID parameter", 400);
    }

    const existingGroup = await db.query.laundryGroups.findFirst({
      where: eq(laundryGroups.id, groupId),
    });

    if (!existingGroup) {
      throw new AppError("Laundry group not found", 404);
    }

    const { name, groupOrder, roomRangeStart, roomRangeEnd, status } = req.body;

    const updateData = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (roomRangeStart !== undefined) updateData.roomRangeStart = roomRangeStart.trim();
    if (roomRangeEnd !== undefined) updateData.roomRangeEnd = roomRangeEnd.trim();
    if (status !== undefined) updateData.status = status;

    if (groupOrder !== undefined && groupOrder !== existingGroup.groupOrder) {
      // Check collision
      const orderConflict = await db
        .select({ id: laundryGroups.id })
        .from(laundryGroups)
        .where(
          and(
            eq(laundryGroups.hostelId, existingGroup.hostelId),
            eq(laundryGroups.groupOrder, groupOrder)
          )
        )
        .limit(1);

      if (orderConflict.length > 0) {
        throw new AppError(
          `Another group in this hostel already uses group order #${groupOrder}`,
          409
        );
      }
      updateData.groupOrder = groupOrder;
    }

    const [updatedGroup] = await db
      .update(laundryGroups)
      .set(updateData)
      .where(eq(laundryGroups.id, groupId))
      .returning();

    return res.status(200).json({
      success: true,
      message: "Laundry group updated successfully",
      data: {
        group: updatedGroup,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. Resolve Group for Room (Helper/Preview Endpoint)
// ==========================================
export const resolveGroup = async (req, res, next) => {
  try {
    const { hostelId, roomNumber } = req.query;

    if (!hostelId || !roomNumber) {
      throw new AppError("hostelId and roomNumber query parameters are required", 400);
    }

    const resolved = await resolveGroupByRoom(parseInt(hostelId, 10), roomNumber);

    if (!resolved) {
      return res.status(200).json({
        success: true,
        message: "No active laundry group covers this room number",
        data: { group: null },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Laundry group resolved successfully",
      data: { group: resolved },
    });
  } catch (error) {
    next(error);
  }
};
