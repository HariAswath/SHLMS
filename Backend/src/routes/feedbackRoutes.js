import express from "express";
import {
  submitFeedback,
  getAllFeedback,
  getFeedbackAnalytics,
} from "../controllers/feedbackController.js";
import { authenticateToken, requireRole } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import { submitFeedbackSchema } from "../utils/validators/feedbackValidators.js";

const router = express.Router();

router.use(authenticateToken);

// 1. View Feedback Analytics (Admin Only - above /)
router.get("/analytics", requireRole("admin"), getFeedbackAnalytics);

// 2. Submit Feedback (Student Only)
router.post(
  "/",
  requireRole("student"),
  validate(submitFeedbackSchema),
  submitFeedback
);

// 3. List All Feedback (Admin Only)
router.get("/", requireRole("admin"), getAllFeedback);

export default router;
