import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// ==========================================
// Schedule Generation Schema
// ==========================================
export const generateScheduleSchema = {
  body: z
    .object({
      startDate: z.string().regex(dateRegex, "startDate must be in YYYY-MM-DD format"),
      endDate: z.string().regex(dateRegex, "endDate must be in YYYY-MM-DD format"),
      hostelId: z.number().int().positive().optional(),
      startTime: z.string().optional().default("08:00"),
      endTime: z.string().optional().default("18:00"),
    })
    .refine((data) => data.endDate >= data.startDate, {
      message: "endDate must be greater than or equal to startDate",
      path: ["endDate"],
    }),
};

// ==========================================
// Holiday Schemas
// ==========================================
export const createHolidaySchema = {
  body: z.object({
    date: z.string().regex(dateRegex, "date must be in YYYY-MM-DD format"),
    reason: z.string().min(2, "Reason must be at least 2 characters long"),
    shiftFutureSchedules: z.boolean().optional().default(true),
  }),
};

export const updateHolidaySchema = {
  params: z.object({
    id: z.coerce.number().int().positive("Invalid holiday ID parameter"),
  }),
  body: z.object({
    date: z.string().regex(dateRegex, "date must be in YYYY-MM-DD format").optional(),
    reason: z.string().min(2).optional(),
  }),
};

// ==========================================
// Patch Schedule Schema
// ==========================================
export const patchScheduleSchema = {
  params: z.object({
    id: z.coerce.number().int().positive("Invalid schedule ID parameter"),
  }),
  body: z.object({
    groupId: z.number().int().positive().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    status: z.enum(["scheduled", "active", "completed", "cancelled"]).optional(),
  }),
};
