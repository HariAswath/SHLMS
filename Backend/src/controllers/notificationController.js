import { db } from "../db/db.js";
import { notifications } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { AppError } from "../utils/AppError.js";

// ==========================================
// 1. Get User's Own Notifications
// ==========================================
export const getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    const unreadCount = list.filter((n) => !n.isRead).length;

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: {
        unreadCount,
        total: list.length,
        notifications: list,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. Mark Single Notification as Read
// ==========================================
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const notificationId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(notificationId)) {
      throw new AppError("Invalid notification ID parameter", 400);
    }

    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (!notification) {
      throw new AppError("Notification not found", 404);
    }

    if (notification.userId !== userId) {
      throw new AppError("Forbidden: You cannot modify another user's notifications", 403);
    }

    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId))
      .returning();

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: {
        notification: updated,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. Mark All Notifications as Read
// ==========================================
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const updated = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .returning();

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: {
        updatedCount: updated.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
