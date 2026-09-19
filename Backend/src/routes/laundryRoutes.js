import express from "express";
import {
  verifySubmission,
  submitLaundry,
  getTodayQueue,
  getMyLaundry,
  getLaundryById,
  updateLaundryStatus,
  verifyPickupAndDeliver,
} from "../controllers/laundryController.js";
import { authenticateToken, requireRole } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import {
  verifySubmissionSchema,
  submitLaundrySchema,
  updateLaundryStatusSchema,
  verifyPickupSchema,
} from "../utils/validators/laundryValidators.js";

const router = express.Router();

// All laundry routes require authentication
router.use(authenticateToken);

// ==========================================
// Operational Counter Endpoints (Must be above /:id)
// ==========================================
// 1. Verify Submission Eligibility via QR scan (Staff & Admin)
router.post(
  "/verify-submission",
  requireRole("staff", "admin"),
  validate(verifySubmissionSchema),
  verifySubmission
);

// 2. Submit Laundry Record (Staff & Admin)
router.post(
  "/submit",
  requireRole("staff", "admin"),
  validate(submitLaundrySchema),
  submitLaundry
);

// 3. Today's Operational Queue & Statistics (Staff & Admin)
router.get(
  "/today/queue",
  requireRole("staff", "admin"),
  getTodayQueue
);

// 4. Student's Own Laundry History (Student only)
router.get(
  "/my",
  requireRole("student"),
  getMyLaundry
);

// 5. Direct QR Pickup Verification without Record ID (Staff & Admin)
router.post(
  "/verify-pickup",
  requireRole("staff", "admin"),
  validate(verifyPickupSchema),
  verifyPickupAndDeliver
);

// ==========================================
// Parameterized Laundry Item Endpoints
// ==========================================
// 6. Get Laundry Record By ID (Admin, Staff, or Student Owner)
router.get("/:id", getLaundryById);

// 6. Update Laundry Status with Transition Guard (Staff & Admin)
router.patch(
  "/:id/status",
  requireRole("staff", "admin"),
  validate(updateLaundryStatusSchema),
  updateLaundryStatus
);

// 7. Verify QR Code at Pickup and Mark Delivered (Staff & Admin)
router.post(
  "/:id/verify-pickup",
  requireRole("staff", "admin"),
  validate(verifyPickupSchema),
  verifyPickupAndDeliver
);

export default router;
