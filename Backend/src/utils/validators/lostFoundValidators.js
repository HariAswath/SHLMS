import { z } from "zod";

// ==========================================
// Create Lost & Found Item Schema (Staff & Admin)
// ==========================================
export const createLostFoundSchema = {
  body: z.object({
    title: z.string().trim().min(2, "Title must be at least 2 characters long"),
    description: z.string().trim().max(1000, "Description cannot exceed 1000 characters").optional(),
    category: z.string().trim().min(2, "Category must be specified (e.g. shirt, jacket, towel)"),
    color: z.string().trim().max(50).optional(),
    imageUrl: z.string().url("Invalid image URL format").optional().or(z.literal("")),
    foundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "foundDate must be in YYYY-MM-DD format").optional(),
  }),
};

// ==========================================
// Submit Claim Schema (Student)
// ==========================================
export const createClaimSchema = {
  params: z.object({
    id: z.coerce.number().int().positive("Invalid item ID parameter"),
  }),
  body: z.object({
    description: z
      .string()
      .trim()
      .min(5, "Claim description / proof of ownership must be at least 5 characters long")
      .max(1000, "Description cannot exceed 1000 characters"),
  }),
};

// ==========================================
// Review Claim Schema (Admin Only)
// ==========================================
export const reviewClaimSchema = {
  params: z.object({
    claimId: z.coerce.number().int().positive("Invalid claim ID parameter"),
  }),
  body: z.object({
    status: z.enum(["approved", "rejected"], {
      errorMap: () => ({ message: "Status must be either 'approved' or 'rejected'" }),
    }),
    remarks: z.string().trim().max(1000, "Remarks cannot exceed 1000 characters").optional(),
  }),
};
