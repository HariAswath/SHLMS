import express from "express";
import {
  getDashboardSummary,
  getLaundryReport,
  getComplaintsReport,
  getFeedbackReport,
} from "../controllers/reportController.js";
import { authenticateToken, requireRole } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import { reportDateRangeSchema } from "../utils/validators/reportValidators.js";

const router = express.Router();

router.use(authenticateToken);

// 1. Dashboard Executive Summary (Staff & Admin)
router.get("/dashboard", requireRole("admin", "staff"), getDashboardSummary);

// 2. Laundry Operational Report (Staff & Admin)
router.get(
  "/laundry",
  requireRole("admin", "staff"),
  validate(reportDateRangeSchema),
  getLaundryReport
);

// 3. Complaints Operational Report (Admin Only)
router.get(
  "/complaints",
  requireRole("admin"),
  validate(reportDateRangeSchema),
  getComplaintsReport
);

// 4. Feedback & Customer Satisfaction Report (Admin Only)
router.get(
  "/feedback",
  requireRole("admin"),
  validate(reportDateRangeSchema),
  getFeedbackReport
);

export default router;
