import { z } from "zod";

// ==========================================
// Submit Feedback Schema (Student Only)
// ==========================================
export const submitFeedbackSchema = {
  body: z.object({
    laundryId: z.coerce.number().int().positive("Valid delivered laundry ID is required"),
    cleanlinessRating: z
      .coerce
      .number()
      .int()
      .min(1, "Cleanliness rating must be between 1 and 5")
      .max(5, "Cleanliness rating must be between 1 and 5"),
    timelinessRating: z
      .coerce
      .number()
      .int()
      .min(1, "Timeliness rating must be between 1 and 5")
      .max(5, "Timeliness rating must be between 1 and 5"),
    staffServiceRating: z
      .coerce
      .number()
      .int()
      .min(1, "Staff service rating must be between 1 and 5")
      .max(5, "Staff service rating must be between 1 and 5"),
    overallRating: z
      .coerce
      .number()
      .int()
      .min(1, "Overall rating must be between 1 and 5")
      .max(5, "Overall rating must be between 1 and 5"),
    comment: z.string().trim().max(1000, "Comment cannot exceed 1000 characters").optional(),
  }),
};
