import express from "express";
import {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
} from "../controllers/complaintController.js";
import { authenticateToken, requireRole } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import {
  createComplaintSchema,
  updateComplaintStatusSchema,
} from "../utils/validators/complaintValidators.js";

const router = express.Router();

router.use(authenticateToken);

// 1. Create Complaint (Student or Admin)
router.post(
  "/",
  requireRole("student", "admin"),
  validate(createComplaintSchema),
  createComplaint
);

// 2. List Complaints (Students view own, Staff/Admin view all)
router.get("/", getComplaints);

// 3. View Complaint by ID
router.get("/:id", getComplaintById);

// 4. Update Complaint Status & Remarks (Admin Only)
router.patch(
  "/:id/status",
  requireRole("admin"),
  validate(updateComplaintStatusSchema),
  updateComplaintStatus
);

export default router;
