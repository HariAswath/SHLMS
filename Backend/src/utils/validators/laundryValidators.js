import { z } from "zod";

// ==========================================
// Verify Submission Schema (QR scan)
// ==========================================
export const verifySubmissionSchema = {
  body: z.object({
    barcodeValue: z.string().min(1, "Barcode/QR value is required"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  }),
};

// ==========================================
// Submit Laundry Schema (Staff records clothes)
// ==========================================
export const submitLaundrySchema = {
  body: z.object({
    barcodeValue: z.string().min(1, "Barcode/QR value is required"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
    clothDetails: z
      .record(z.string(), z.number().int().nonnegative())
      .refine(
        (details) => {
          const totalItems = Object.values(details).reduce((sum, count) => sum + count, 0);
          return totalItems > 0;
        },
        {
          message: "At least one item must be submitted in clothDetails",
          path: ["clothDetails"],
        }
      ),
  }),
};

// ==========================================
// Update Laundry Status Schema
// ==========================================
export const updateLaundryStatusSchema = {
  params: z.object({
    id: z.coerce.number().int().positive("Invalid laundry ID parameter"),
  }),
  body: z.object({
    status: z.enum(["received", "ready_for_pickup", "delivered"], {
      errorMap: () => ({ message: "Status must be 'received', 'ready_for_pickup', or 'delivered'" }),
    }),
  }),
};

// ==========================================
// Verify Pickup Schema (Student QR scan at pickup)
// ==========================================
export const verifyPickupSchema = {
  params: z.object({
    id: z.coerce.number().int().positive("Invalid laundry ID parameter").optional(),
  }),
  body: z.object({
    barcodeValue: z.string().min(1, "Student barcode/QR value is required for pickup verification"),
  }),
};

