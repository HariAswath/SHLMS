import { relations } from "drizzle-orm";
import {
  users,
  hostels,
  floors,
  rooms,
  laundryGroups,
  schedules,
  holidays,
  laundryRecords,
  complaints,
  lostFound,
  lostFoundClaims,
  feedback,
  notifications,
} from "./schema.js";

// ==========================================
// Users Relations
// ==========================================
export const usersRelations = relations(users, ({ one, many }) => ({
  hostel: one(hostels, {
    fields: [users.hostelId],
    references: [hostels.id],
  }),
  floor: one(floors, {
    fields: [users.floorId],
    references: [floors.id],
  }),
  room: one(rooms, {
    fields: [users.roomId],
    references: [rooms.id],
  }),
  laundryRecords: many(laundryRecords, { relationName: "studentLaundries" }),
  processedRecords: many(laundryRecords, { relationName: "staffProcessedLaundries" }),
  complaints: many(complaints, { relationName: "studentComplaints" }),
  resolvedComplaints: many(complaints, { relationName: "adminResolvedComplaints" }),
  reportedLostItems: many(lostFound),
  lostFoundClaims: many(lostFoundClaims, { relationName: "studentClaims" }),
  reviewedClaims: many(lostFoundClaims, { relationName: "adminReviewedClaims" }),
  feedback: many(feedback),
  notifications: many(notifications),
  createdSchedules: many(schedules),
  createdHolidays: many(holidays),
}));

// ==========================================
// Hostels Relations
// ==========================================
export const hostelsRelations = relations(hostels, ({ many }) => ({
  floors: many(floors),
  laundryGroups: many(laundryGroups),
  users: many(users),
}));

// ==========================================
// Floors Relations
// ==========================================
export const floorsRelations = relations(floors, ({ one, many }) => ({
  hostel: one(hostels, {
    fields: [floors.hostelId],
    references: [hostels.id],
  }),
  rooms: many(rooms),
  users: many(users),
}));

// ==========================================
// Rooms Relations
// ==========================================
export const roomsRelations = relations(rooms, ({ one, many }) => ({
  floor: one(floors, {
    fields: [rooms.floorId],
    references: [floors.id],
  }),
  users: many(users),
}));

// ==========================================
// Laundry Groups Relations
// ==========================================
export const laundryGroupsRelations = relations(laundryGroups, ({ one, many }) => ({
  hostel: one(hostels, {
    fields: [laundryGroups.hostelId],
    references: [hostels.id],
  }),
  schedules: many(schedules),
}));

// ==========================================
// Schedules Relations
// ==========================================
export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  group: one(laundryGroups, {
    fields: [schedules.groupId],
    references: [laundryGroups.id],
  }),
  creator: one(users, {
    fields: [schedules.createdBy],
    references: [users.id],
  }),
  laundryRecords: many(laundryRecords),
}));

// ==========================================
// Holidays Relations
// ==========================================
export const holidaysRelations = relations(holidays, ({ one }) => ({
  creator: one(users, {
    fields: [holidays.createdBy],
    references: [users.id],
  }),
}));

// ==========================================
// Laundry Records Relations
// ==========================================
export const laundryRecordsRelations = relations(laundryRecords, ({ one, many }) => ({
  student: one(users, {
    fields: [laundryRecords.studentId],
    references: [users.id],
    relationName: "studentLaundries",
  }),
  schedule: one(schedules, {
    fields: [laundryRecords.scheduleId],
    references: [schedules.id],
  }),
  staff: one(users, {
    fields: [laundryRecords.submittedByStaffId],
    references: [users.id],
    relationName: "staffProcessedLaundries",
  }),
  complaints: many(complaints),
  feedback: many(feedback),
}));

// ==========================================
// Complaints Relations
// ==========================================
export const complaintsRelations = relations(complaints, ({ one }) => ({
  student: one(users, {
    fields: [complaints.studentId],
    references: [users.id],
    relationName: "studentComplaints",
  }),
  laundry: one(laundryRecords, {
    fields: [complaints.laundryId],
    references: [laundryRecords.id],
  }),
  resolver: one(users, {
    fields: [complaints.resolvedBy],
    references: [users.id],
    relationName: "adminResolvedComplaints",
  }),
}));

// ==========================================
// Lost & Found Relations
// ==========================================
export const lostFoundRelations = relations(lostFound, ({ one, many }) => ({
  reporter: one(users, {
    fields: [lostFound.reportedByStaffId],
    references: [users.id],
  }),
  claims: many(lostFoundClaims),
}));

// ==========================================
// Lost & Found Claims Relations
// ==========================================
export const lostFoundClaimsRelations = relations(lostFoundClaims, ({ one }) => ({
  item: one(lostFound, {
    fields: [lostFoundClaims.itemId],
    references: [lostFound.id],
  }),
  student: one(users, {
    fields: [lostFoundClaims.studentId],
    references: [users.id],
    relationName: "studentClaims",
  }),
  reviewer: one(users, {
    fields: [lostFoundClaims.reviewedBy],
    references: [users.id],
    relationName: "adminReviewedClaims",
  }),
}));

// ==========================================
// Feedback Relations
// ==========================================
export const feedbackRelations = relations(feedback, ({ one }) => ({
  student: one(users, {
    fields: [feedback.studentId],
    references: [users.id],
  }),
  laundry: one(laundryRecords, {
    fields: [feedback.laundryId],
    references: [laundryRecords.id],
  }),
}));

// ==========================================
// Notifications Relations
// ==========================================
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
