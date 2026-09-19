import express from "express";
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/notificationController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import { markNotificationReadSchema } from "../utils/validators/notificationValidators.js";

const router = express.Router();

router.use(authenticateToken);

// 1. Get User's Own Notifications
router.get("/", getMyNotifications);

// 2. Mark All Notifications as Read (above /:id)
router.patch("/read-all", markAllNotificationsAsRead);

// 3. Mark Single Notification as Read
router.patch("/:id/read", validate(markNotificationReadSchema), markNotificationAsRead);

export default router;
