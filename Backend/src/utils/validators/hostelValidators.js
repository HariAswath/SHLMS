import { z } from "zod";

// ==========================================
// Hostel Validation Schemas
// ==========================================
export const createHostelSchema = {
  body: z.object({
    name: z.string().min(2, "Hostel name must be at least 2 characters long"),
    code: z
      .string()
      .min(2, "Hostel code must be at least 2 characters long")
      .transform((val) => val.trim().toUpperCase()),
    status: z.enum(["active", "inactive"]).optional().default("active"),
  }),
};

// ==========================================
// Floor Validation Schemas
// ==========================================
export const createFloorSchema = {
  params: z.object({
    id: z.coerce.number().int().positive("Invalid hostel ID parameter"),
  }),
  body: z.object({
    floorNumber: z.number().int().min(0, "Floor number must be 0 (Ground) or positive"),
    name: z.string().optional(),
  }),
};

// ==========================================
// Room Validation Schemas
// ==========================================
export const createRoomSchema = {
  params: z.object({
    id: z.coerce.number().int().positive("Invalid hostel ID parameter"),
  }),
  body: z.object({
    floorId: z.number().int().positive("Floor ID must be a valid positive integer"),
    roomNumber: z.string().min(1, "Room number is required"),
    status: z.enum(["active", "inactive"]).optional().default("active"),
  }),
};

export const createRoomsBulkSchema = {
  params: z.object({
    id: z.coerce.number().int().positive("Invalid hostel ID parameter"),
  }),
  body: z.object({
    floorId: z.number().int().positive("Floor ID must be a valid positive integer"),
    startRoom: z.number().int().positive("startRoom must be a positive integer"),
    endRoom: z.number().int().positive("endRoom must be a positive integer"),
  }).refine((data) => data.endRoom >= data.startRoom, {
    message: "endRoom must be greater than or equal to startRoom",
    path: ["endRoom"],
  }),
};

// ==========================================
// Laundry Group Validation Schemas
// ==========================================
export const createLaundryGroupSchema = {
  body: z
    .object({
      hostelId: z.number().int().positive("Hostel ID is required"),
      name: z.string().min(2, "Group name must be at least 2 characters long"),
      groupOrder: z.number().int().positive("Group order must be a positive integer"),
      roomRangeStart: z.string().min(1, "roomRangeStart is required"),
      roomRangeEnd: z.string().min(1, "roomRangeEnd is required"),
      status: z.enum(["active", "inactive"]).optional().default("active"),
    })
    .refine(
      (data) => {
        const start = parseInt(data.roomRangeStart, 10);
        const end = parseInt(data.roomRangeEnd, 10);
        if (!isNaN(start) && !isNaN(end)) {
          return end >= start;
        }
        return true;
      },
      {
        message: "roomRangeEnd must be greater than or equal to roomRangeStart",
        path: ["roomRangeEnd"],
      }
    ),
};

export const updateLaundryGroupSchema = {
  params: z.object({
    id: z.coerce.number().int().positive("Invalid group ID parameter"),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    groupOrder: z.number().int().positive().optional(),
    roomRangeStart: z.string().optional(),
    roomRangeEnd: z.string().optional(),
    status: z.enum(["active", "inactive"]).optional(),
  }),
};
