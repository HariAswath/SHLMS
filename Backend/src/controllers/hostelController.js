import { db } from "../db/db.js";
import { hostels, floors, rooms } from "../db/schema.js";
import { eq, and, asc } from "drizzle-orm";
import { AppError } from "../utils/AppError.js";

// ==========================================
// 1. Create Hostel (Admin Only)
// ==========================================
export const createHostel = async (req, res, next) => {
  try {
    const { name, code, status = "active" } = req.body;
    const normalizedCode = code.trim().toUpperCase();

    // Check unique code
    const existing = await db
      .select({ id: hostels.id })
      .from(hostels)
      .where(eq(hostels.code, normalizedCode))
      .limit(1);

    if (existing.length > 0) {
      throw new AppError(`Hostel with code '${normalizedCode}' already exists`, 409);
    }

    const [newHostel] = await db
      .insert(hostels)
      .values({
        name: name.trim(),
        code: normalizedCode,
        status,
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Hostel block created successfully",
      data: {
        hostel: newHostel,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. Get All Hostels (All Authenticated Roles)
// ==========================================
export const getHostels = async (req, res, next) => {
  try {
    const { status } = req.query;

    const queryCondition = status ? eq(hostels.status, status) : undefined;

    const hostelRecords = await db.query.hostels.findMany({
      where: queryCondition,
      orderBy: [asc(hostels.name)],
      with: {
        floors: {
          orderBy: [asc(floors.floorNumber)],
        },
        laundryGroups: {
          orderBy: [asc(hostels.name)],
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Hostels retrieved successfully",
      data: {
        hostels: hostelRecords,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. Get Hostel By ID
// ==========================================
export const getHostelById = async (req, res, next) => {
  try {
    const hostelId = parseInt(req.params.id, 10);
    if (isNaN(hostelId)) {
      throw new AppError("Invalid hostel ID parameter", 400);
    }

    const hostel = await db.query.hostels.findFirst({
      where: eq(hostels.id, hostelId),
      with: {
        floors: {
          orderBy: [asc(floors.floorNumber)],
          with: {
            rooms: {
              orderBy: [asc(rooms.roomNumber)],
            },
          },
        },
        laundryGroups: true,
      },
    });

    if (!hostel) {
      throw new AppError("Hostel not found", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Hostel details retrieved successfully",
      data: {
        hostel,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. Create Floor in Hostel (Admin Only)
// ==========================================
export const createFloor = async (req, res, next) => {
  try {
    const hostelId = parseInt(req.params.id, 10);
    const { floorNumber, name } = req.body;

    // Check hostel exists
    const [hostel] = await db
      .select({ id: hostels.id })
      .from(hostels)
      .where(eq(hostels.id, hostelId))
      .limit(1);

    if (!hostel) {
      throw new AppError("Hostel not found", 404);
    }

    // Check duplicate floorNumber in same hostel
    const existingFloor = await db
      .select({ id: floors.id })
      .from(floors)
      .where(and(eq(floors.hostelId, hostelId), eq(floors.floorNumber, floorNumber)))
      .limit(1);

    if (existingFloor.length > 0) {
      throw new AppError(`Floor ${floorNumber} already exists in this hostel`, 409);
    }

    const [newFloor] = await db
      .insert(floors)
      .values({
        hostelId,
        floorNumber,
        name: name ? name.trim() : `Floor ${floorNumber}`,
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Floor added successfully",
      data: {
        floor: newFloor,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. Get Floors of a Hostel
// ==========================================
export const getFloors = async (req, res, next) => {
  try {
    const hostelId = parseInt(req.params.id, 10);

    const floorList = await db
      .select()
      .from(floors)
      .where(eq(floors.hostelId, hostelId))
      .orderBy(asc(floors.floorNumber));

    return res.status(200).json({
      success: true,
      message: "Floors retrieved successfully",
      data: {
        floors: floorList,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 6. Create Room in Floor/Hostel (Admin Only)
// ==========================================
export const createRoom = async (req, res, next) => {
  try {
    const hostelId = parseInt(req.params.id, 10);
    const { floorId, roomNumber, status = "active" } = req.body;
    const trimmedRoom = String(roomNumber).trim();

    // Verify floor belongs to this hostel
    const [floor] = await db
      .select({ id: floors.id, hostelId: floors.hostelId })
      .from(floors)
      .where(eq(floors.id, floorId))
      .limit(1);

    if (!floor) {
      throw new AppError("Floor not found", 404);
    }
    if (floor.hostelId !== hostelId) {
      throw new AppError("The specified floor does not belong to this hostel", 400);
    }

    // Check duplicate room on this floor
    const existingRoom = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(eq(rooms.floorId, floorId), eq(rooms.roomNumber, trimmedRoom)))
      .limit(1);

    if (existingRoom.length > 0) {
      throw new AppError(`Room '${trimmedRoom}' already exists on this floor`, 409);
    }

    const [newRoom] = await db
      .insert(rooms)
      .values({
        floorId,
        roomNumber: trimmedRoom,
        status,
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: {
        room: newRoom,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 7. Bulk Create Rooms (Range, e.g. 101 to 120)
// ==========================================
export const createRoomsBulk = async (req, res, next) => {
  try {
    const hostelId = parseInt(req.params.id, 10);
    const { floorId, startRoom, endRoom } = req.body;

    // Verify floor belongs to this hostel
    const [floor] = await db
      .select({ id: floors.id, hostelId: floors.hostelId })
      .from(floors)
      .where(eq(floors.id, floorId))
      .limit(1);

    if (!floor) {
      throw new AppError("Floor not found", 404);
    }
    if (floor.hostelId !== hostelId) {
      throw new AppError("The specified floor does not belong to this hostel", 400);
    }

    const createdRoomsList = [];
    for (let r = startRoom; r <= endRoom; r++) {
      const roomStr = String(r);
      // Skip if room already exists
      const existing = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(and(eq(rooms.floorId, floorId), eq(rooms.roomNumber, roomStr)))
        .limit(1);

      if (existing.length === 0) {
        const [inserted] = await db
          .insert(rooms)
          .values({
            floorId,
            roomNumber: roomStr,
            status: "active",
          })
          .returning();
        createdRoomsList.push(inserted);
      }
    }

    return res.status(201).json({
      success: true,
      message: `Bulk created ${createdRoomsList.length} rooms successfully`,
      data: {
        createdCount: createdRoomsList.length,
        rooms: createdRoomsList,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 8. Get Rooms of a Hostel / Floor
// ==========================================
export const getRooms = async (req, res, next) => {
  try {
    const hostelId = parseInt(req.params.id, 10);
    const { floorId } = req.query;

    // Fetch floors of this hostel first
    const hostelFloors = await db
      .select({ id: floors.id })
      .from(floors)
      .where(eq(floors.hostelId, hostelId));

    if (hostelFloors.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Rooms retrieved successfully",
        data: { rooms: [] },
      });
    }

    const floorIds = hostelFloors.map((f) => f.id);
    const filterFloorId = floorId ? parseInt(floorId, 10) : null;

    let roomList;
    if (filterFloorId && floorIds.includes(filterFloorId)) {
      roomList = await db.query.rooms.findMany({
        where: eq(rooms.floorId, filterFloorId),
        orderBy: [asc(rooms.roomNumber)],
        with: {
          floor: true,
        },
      });
    } else {
      roomList = await db.query.rooms.findMany({
        where: (rooms, { inArray }) => inArray(rooms.floorId, floorIds),
        orderBy: [asc(rooms.roomNumber)],
        with: {
          floor: true,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Rooms retrieved successfully",
      data: {
        rooms: roomList,
      },
    });
  } catch (error) {
    next(error);
  }
};
