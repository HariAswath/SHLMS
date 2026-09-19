import { z } from "zod";

// ==========================================
// Create Complaint Schema
// ==========================================
export const createComplaintSchema = {
  body: z.object({
    laundryId: z.coerce.number().int().positive("Invalid laundry ID").optional(),
    category: z.enum(
      ["missing_clothes", "damaged_clothes", "wrong_item", "delay", "other"],
      {
        errorMap: () => ({
          message:
            "Category must be one of: 'missing_clothes', 'damaged_clothes', 'wrong_item', 'delay', 'other'",
        }),
      }
    ),
    description: z
      .string()
      .trim()
      .min(5, "Description must be at least 5 characters long")
      .max(1000, "Description cannot exceed 1000 characters"),
    imageUrl: z.string().url("Invalid image URL format").optional().or(z.literal("")),
  }),
};

// ==========================================
// Update Complaint Status Schema (Admin Only)
// ==========================================
export const updateComplaintStatusSchema = {
  params: z.object({
    id: z.coerce.number().int().positive("Invalid complaint ID parameter"),
  }),
  body: z.object({
    status: z.enum(["open", "under_review", "resolved", "rejected", "closed"], {
      errorMap: () => ({
        message:
          "Status must be one of: 'open', 'under_review', 'resolved', 'rejected', 'closed'",
      }),
    }),
    adminRemarks: z.string().trim().max(1000, "Admin remarks cannot exceed 1000 characters").optional(),
  }),
};
