import express from "express";
import {
  generateSchedule,
  getSchedules,
  getTodaySchedule,
  getMySchedule,
  getUpcomingSchedules,
  patchSchedule,
  createHoliday,
  getHolidays,
  updateHoliday,
} from "../controllers/scheduleController.js";
import { authenticateToken, requireRole } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import {
  generateScheduleSchema,
  createHolidaySchema,
  updateHolidaySchema,
  patchScheduleSchema,
} from "../utils/validators/scheduleValidators.js";

const router = express.Router();

// All scheduling routes require authentication
router.use(authenticateToken);

// ==========================================
// Holiday Endpoints (Must be above /:id)
// ==========================================
router.post(
  "/holidays",
  requireRole("admin"),
  validate(createHolidaySchema),
  createHoliday
);
router.get("/holidays", getHolidays);
router.patch(
  "/holidays/:id",
  requireRole("admin"),
  validate(updateHolidaySchema),
  updateHoliday
);

// ==========================================
// Operational Schedule Views (Must be above /:id)
// ==========================================
router.get("/today", getTodaySchedule);
router.get("/my", requireRole("student"), getMySchedule);
router.get("/upcoming", getUpcomingSchedules);

// ==========================================
// General Schedule Endpoints
// ==========================================
router.post(
  "/",
  requireRole("admin"),
  validate(generateScheduleSchema),
  generateSchedule
);
router.get("/", getSchedules);
router.patch(
  "/:id",
  requireRole("admin"),
  validate(patchScheduleSchema),
  patchSchedule
);

export default router;
