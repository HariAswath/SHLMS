CREATE TABLE "complaints" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"laundry_id" integer,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"image_url" text,
	"status" text DEFAULT 'open' NOT NULL,
	"admin_remarks" text,
	"resolved_by" integer,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"laundry_id" integer NOT NULL,
	"cleanliness_rating" integer NOT NULL,
	"timeliness_rating" integer NOT NULL,
	"staff_service_rating" integer NOT NULL,
	"overall_rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "floors" (
	"id" serial PRIMARY KEY NOT NULL,
	"hostel_id" integer NOT NULL,
	"floor_number" integer NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"reason" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "holidays_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "hostels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hostels_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "laundry_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"hostel_id" integer NOT NULL,
	"name" text NOT NULL,
	"group_order" integer NOT NULL,
	"room_range_start" text,
	"room_range_end" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "laundry_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"schedule_id" integer,
	"submitted_by_staff_id" integer,
	"status" text DEFAULT 'received' NOT NULL,
	"cloth_details" jsonb NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"ready_at" timestamp,
	"delivered_at" timestamp,
	"pickup_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lost_found" (
	"id" serial PRIMARY KEY NOT NULL,
	"reported_by_staff_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"color" text,
	"image_url" text,
	"found_date" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lost_found_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"floor_id" integer NOT NULL,
	"room_number" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_date" date NOT NULL,
	"group_id" integer NOT NULL,
	"start_time" text,
	"end_time" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"rotation_position" integer NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"student_id" text,
	"employee_id" text,
	"phone" text,
	"hostel_id" integer,
	"floor_id" integer,
	"room_id" integer,
	"barcode_value" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_barcode_value_unique" UNIQUE("barcode_value")
);
--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_laundry_id_laundry_records_id_fk" FOREIGN KEY ("laundry_id") REFERENCES "public"."laundry_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_laundry_id_laundry_records_id_fk" FOREIGN KEY ("laundry_id") REFERENCES "public"."laundry_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floors" ADD CONSTRAINT "floors_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laundry_groups" ADD CONSTRAINT "laundry_groups_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laundry_records" ADD CONSTRAINT "laundry_records_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laundry_records" ADD CONSTRAINT "laundry_records_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laundry_records" ADD CONSTRAINT "laundry_records_submitted_by_staff_id_users_id_fk" FOREIGN KEY ("submitted_by_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found" ADD CONSTRAINT "lost_found_reported_by_staff_id_users_id_fk" FOREIGN KEY ("reported_by_staff_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_claims" ADD CONSTRAINT "lost_found_claims_item_id_lost_found_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."lost_found"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_claims" ADD CONSTRAINT "lost_found_claims_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_found_claims" ADD CONSTRAINT "lost_found_claims_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_floor_id_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_group_id_laundry_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."laundry_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_floor_id_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "complaints_student_id_idx" ON "complaints" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "laundry_records_student_id_idx" ON "laundry_records" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "laundry_records_status_idx" ON "laundry_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "schedules_date_idx" ON "schedules" USING btree ("schedule_date");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_student_id_idx" ON "users" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "users_barcode_value_idx" ON "users" USING btree ("barcode_value");