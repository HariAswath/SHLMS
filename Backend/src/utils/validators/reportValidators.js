import { z } from "zod";

// ==========================================
// Date Range Query Schema for Reports
// ==========================================
export const reportDateRangeSchema = {
  query: z.object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be in YYYY-MM-DD format")
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be in YYYY-MM-DD format")
      .optional(),
    status: z.string().optional(),
  }),
};
