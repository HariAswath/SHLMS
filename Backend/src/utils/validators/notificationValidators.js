import { z } from "zod";

// ==========================================
// Mark Single Notification Read Schema
// ==========================================
export const markNotificationReadSchema = {
  params: z.object({
    id: z.coerce.number().int().positive("Invalid notification ID parameter"),
  }),
};
