import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ==========================================
// 1. Hostels Table
// ==========================================
export const hostels = pgTable("hostels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  status: text("status").default("active").notNull(), // 'active', 'inactive'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==========================================
// 2. Floors Table
// ==========================================
export const floors = pgTable("floors", {
  id: serial("id").primaryKey(),
  hostelId: integer("hostel_id")
    .references(() => hostels.id, { onDelete: "cascade" })
    .notNull(),
  floorNumber: integer("floor_number").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==========================================
// 3. Rooms Table
// ==========================================
export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  floorId: integer("floor_id")
    .references(() => floors.id, { onDelete: "cascade" })
    .notNull(),
  roomNumber: text("room_number").notNull(),
  status: text("status").default("active").notNull(), // 'active', 'inactive'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==========================================
// 4. Users Table
// ==========================================
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(), // 'student', 'staff', 'admin'
    studentId: text("student_id"),
    employeeId: text("employee_id"),
    phone: text("phone"),
    hostelId: integer("hostel_id").references(() => hostels.id, {
      onDelete: "set null",
    }),
    floorId: integer("floor_id").references(() => floors.id, {
      onDelete: "set null",
    }),
    roomId: integer("room_id").references(() => rooms.id, {
      onDelete: "set null",
    }),
    barcodeValue: text("barcode_value").unique(),
    status: text("status").default("active").notNull(), // 'active', 'inactive'
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("users_email_idx").on(table.email),
    index("users_student_id_idx").on(table.studentId),
    index("users_barcode_value_idx").on(table.barcodeValue),
  ]
);

// ==========================================
// 5. Laundry Groups Table
// ==========================================
export const laundryGroups = pgTable("laundry_groups", {
  id: serial("id").primaryKey(),
  hostelId: integer("hostel_id")
    .references(() => hostels.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(), // e.g. "Group 1", "Group 2"
  groupOrder: integer("group_order").notNull(), // 1, 2, 3, 4, 5...
  roomRangeStart: text("room_range_start"), // e.g. "101"
  roomRangeEnd: text("room_range_end"), // e.g. "233"
  status: text("status").default("active").notNull(), // 'active', 'inactive'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==========================================
// 6. Schedules Table (Round-Robin model)
// ==========================================
export const schedules = pgTable(
  "schedules",
  {
    id: serial("id").primaryKey(),
    scheduleDate: date("schedule_date", { mode: "string" }).notNull(), // YYYY-MM-DD
    groupId: integer("group_id")
      .references(() => laundryGroups.id, { onDelete: "cascade" })
      .notNull(),
    startTime: text("start_time"), // e.g. "08:00"
    endTime: text("end_time"), // e.g. "18:00"
    status: text("status").default("scheduled").notNull(), // 'scheduled', 'active', 'completed', 'cancelled'
    rotationPosition: integer("rotation_position").notNull(), // Position in rotation array
    createdBy: integer("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("schedules_date_idx").on(table.scheduleDate)]
);

// ==========================================
// 7. Holidays Table (Pauses/freezes rotation)
// ==========================================
export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull().unique(), // YYYY-MM-DD
  reason: text("reason").notNull(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==========================================
// 8. Laundry Records Table
// ==========================================
export const laundryRecords = pgTable(
  "laundry_records",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    scheduleId: integer("schedule_id").references(() => schedules.id, {
      onDelete: "set null",
    }),
    submittedByStaffId: integer("submitted_by_staff_id").references(
      () => users.id,
      { onDelete: "set null" }
    ),
    status: text("status").default("received").notNull(), // 'received', 'ready_for_pickup', 'delivered'
    clothDetails: jsonb("cloth_details").notNull(), // { shirts: 3, pants: 2, etc. }
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    readyAt: timestamp("ready_at"),
    deliveredAt: timestamp("delivered_at"),
    pickupVerifiedAt: timestamp("pickup_verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("laundry_records_student_id_idx").on(table.studentId),
    index("laundry_records_status_idx").on(table.status),
  ]
);

// ==========================================
// 9. Complaints Table
// ==========================================
export const complaints = pgTable(
  "complaints",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    laundryId: integer("laundry_id").references(() => laundryRecords.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull(), // 'missing_clothes', 'damaged_clothes', 'wrong_item', 'delay', 'other'
    description: text("description").notNull(),
    imageUrl: text("image_url"),
    status: text("status").default("open").notNull(), // 'open', 'under_review', 'resolved', 'rejected', 'closed'
    adminRemarks: text("admin_remarks"),
    resolvedBy: integer("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("complaints_student_id_idx").on(table.studentId)]
);

// ==========================================
// 10. Lost & Found Table
// ==========================================
export const lostFound = pgTable("lost_found", {
  id: serial("id").primaryKey(),
  reportedByStaffId: integer("reported_by_staff_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  color: text("color"),
  imageUrl: text("image_url"),
  foundDate: timestamp("found_date").defaultNow().notNull(),
  status: text("status").default("available").notNull(), // 'available', 'claimed', 'returned'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==========================================
// 11. Lost & Found Claims Table
// ==========================================
export const lostFoundClaims = pgTable("lost_found_claims", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .references(() => lostFound.id, { onDelete: "cascade" })
    .notNull(),
  studentId: integer("student_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  status: text("status").default("pending").notNull(), // 'pending', 'approved', 'rejected'
  reviewedBy: integer("reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewed_at"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==========================================
// 12. Feedback Table
// ==========================================
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  laundryId: integer("laundry_id")
    .references(() => laundryRecords.id, { onDelete: "cascade" })
    .notNull(),
  cleanlinessRating: integer("cleanliness_rating").notNull(), // 1-5
  timelinessRating: integer("timeliness_rating").notNull(), // 1-5
  staffServiceRating: integer("staff_service_rating").notNull(), // 1-5
  overallRating: integer("overall_rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==========================================
// 13. Notifications Table
// ==========================================
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(), // 'schedule', 'laundry_received', 'laundry_ready', 'laundry_delivered', 'complaint', 'claim'
    title: text("title").notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("notifications_user_id_idx").on(table.userId)]
);
