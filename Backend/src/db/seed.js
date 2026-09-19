import { db } from "./db.js";
import {
  users,
  hostels,
  floors,
  rooms,
  laundryGroups,
  schedules,
  holidays,
} from "./schema.js";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("==========================================");
  console.log("[V-Wash] Seeding database...");
  console.log("==========================================");

  try {
    // 1. Password Hashes
    const adminPasswordHash = await bcrypt.hash("admin123", 10);
    const staffPasswordHash = await bcrypt.hash("staff123", 10);
    const studentPasswordHash = await bcrypt.hash("student123", 10);

    // 2. Create Hostel Block
    console.log("-> Seeding Hostel: D Block...");
    let [hostel] = await db
      .select()
      .from(hostels)
      .where(eq(hostels.code, "D-BLOCK"))
      .limit(1);

    if (!hostel) {
      [hostel] = await db
        .insert(hostels)
        .values({
          name: "D Block",
          code: "D-BLOCK",
          status: "active",
        })
        .returning();
    }

    // 3. Create Floors
    console.log("-> Seeding Floors (Floor 1, Floor 2)...");
    let [floor1] = await db
      .select()
      .from(floors)
      .where(eq(floors.floorNumber, 1))
      .limit(1);

    if (!floor1) {
      [floor1] = await db
        .insert(floors)
        .values({
          hostelId: hostel.id,
          floorNumber: 1,
          name: "Floor 1",
        })
        .returning();
    }

    let [floor2] = await db
      .select()
      .from(floors)
      .where(eq(floors.floorNumber, 2))
      .limit(1);

    if (!floor2) {
      [floor2] = await db
        .insert(floors)
        .values({
          hostelId: hostel.id,
          floorNumber: 2,
          name: "Floor 2",
        })
        .returning();
    }

    // 4. Create Rooms (101 to 115 on Floor 1)
    console.log("-> Seeding Rooms 101 to 115...");
    const createdRooms = {};
    for (let r = 101; r <= 115; r++) {
      const roomStr = r.toString();
      let [existingRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.roomNumber, roomStr))
        .limit(1);

      if (!existingRoom) {
        [existingRoom] = await db
          .insert(rooms)
          .values({
            floorId: floor1.id,
            roomNumber: roomStr,
            status: "active",
          })
          .returning();
      }
      createdRooms[roomStr] = existingRoom;
    }

    // 5. Create Laundry Groups (G1 to G5)
    console.log("-> Seeding Laundry Groups (G1 to G5)...");
    const groupDefinitions = [
      { name: "Group 1", groupOrder: 1, roomRangeStart: "101", roomRangeEnd: "103" },
      { name: "Group 2", groupOrder: 2, roomRangeStart: "104", roomRangeEnd: "106" },
      { name: "Group 3", groupOrder: 3, roomRangeStart: "107", roomRangeEnd: "109" },
      { name: "Group 4", groupOrder: 4, roomRangeStart: "110", roomRangeEnd: "112" },
      { name: "Group 5", groupOrder: 5, roomRangeStart: "113", roomRangeEnd: "115" },
    ];

    const createdGroups = [];
    for (const g of groupDefinitions) {
      let [existingGroup] = await db
        .select()
        .from(laundryGroups)
        .where(eq(laundryGroups.groupOrder, g.groupOrder))
        .limit(1);

      if (!existingGroup) {
        [existingGroup] = await db
          .insert(laundryGroups)
          .values({
            hostelId: hostel.id,
            name: g.name,
            groupOrder: g.groupOrder,
            roomRangeStart: g.roomRangeStart,
            roomRangeEnd: g.roomRangeEnd,
            status: "active",
          })
          .returning();
      }
      createdGroups.push(existingGroup);
    }

    // 6. Create Users: Admin, Staff, and Students
    console.log("-> Seeding Users...");

    // Admin
    let [admin] = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@vwash.com"))
      .limit(1);

    if (!admin) {
      [admin] = await db
        .insert(users)
        .values({
          name: "System Administrator",
          email: "admin@vwash.com",
          passwordHash: adminPasswordHash,
          role: "admin",
          status: "active",
        })
        .returning();
    }

    // Staff
    let [staff] = await db
      .select()
      .from(users)
      .where(eq(users.email, "staff@vwash.com"))
      .limit(1);

    if (!staff) {
      [staff] = await db
        .insert(users)
        .values({
          name: "Laundry Staff Member",
          email: "staff@vwash.com",
          passwordHash: staffPasswordHash,
          role: "staff",
          employeeId: "EMP-001",
          phone: "9876543210",
          status: "active",
        })
        .returning();
    }

    // Primary Student (Group 1 - Room 101)
    let [student1] = await db
      .select()
      .from(users)
      .where(eq(users.email, "student@vwash.com"))
      .limit(1);

    if (!student1) {
      [student1] = await db
        .insert(users)
        .values({
          name: "Hari Aswath",
          email: "student@vwash.com",
          passwordHash: studentPasswordHash,
          role: "student",
          studentId: "23BCE1234",
          phone: "9123456780",
          hostelId: hostel.id,
          floorId: floor1.id,
          roomId: createdRooms["101"]?.id,
          barcodeValue: "VW-STU-23BCE1234",
          status: "active",
        })
        .returning();
    }

    // Sample Students in other groups for scheduling / QR test coverage
    const sampleStudents = [
      {
        name: "Arun Kumar",
        email: "arun@vwash.com",
        studentId: "23BCE1002",
        barcodeValue: "VW-STU-23BCE1002",
        room: "105", // Group 2
      },
      {
        name: "Karthik Raja",
        email: "karthik@vwash.com",
        studentId: "23BCE1003",
        barcodeValue: "VW-STU-23BCE1003",
        room: "108", // Group 3
      },
    ];

    for (const s of sampleStudents) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, s.email))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(users).values({
          name: s.name,
          email: s.email,
          passwordHash: studentPasswordHash,
          role: "student",
          studentId: s.studentId,
          hostelId: hostel.id,
          floorId: floor1.id,
          roomId: createdRooms[s.room]?.id,
          barcodeValue: s.barcodeValue,
          status: "active",
        });
      }
    }

    // 7. Seed Sample Holiday
    console.log("-> Seeding Sample Holiday (Sep 25)...");
    const holidayDate = "2026-09-25";
    const existingHoliday = await db
      .select()
      .from(holidays)
      .where(eq(holidays.date, holidayDate))
      .limit(1);

    if (existingHoliday.length === 0) {
      await db.insert(holidays).values({
        date: holidayDate,
        reason: "Hostel Maintenance & Cleaning Day",
        createdBy: admin.id,
      });
    }

    // 8. Seed Sample Schedules demonstrating Round-Robin & Holiday Freeze
    console.log("-> Seeding Round-Robin Schedules for Sep 21 - Sep 27...");
    const sampleScheduleDates = [
      { date: "2026-09-21", groupIdx: 0, rotPos: 0 }, // G1
      { date: "2026-09-22", groupIdx: 1, rotPos: 1 }, // G2
      { date: "2026-09-23", groupIdx: 2, rotPos: 2 }, // G3
      { date: "2026-09-24", groupIdx: 3, rotPos: 3 }, // G4
      // 2026-09-25 is a HOLIDAY! (Freeze: rotation does NOT advance)
      { date: "2026-09-26", groupIdx: 4, rotPos: 4 }, // G5
      { date: "2026-09-27", groupIdx: 0, rotPos: 0 }, // G1 (wrap-around)
    ];

    for (const item of sampleScheduleDates) {
      const existing = await db
        .select()
        .from(schedules)
        .where(eq(schedules.scheduleDate, item.date))
        .limit(1);

      if (existing.length === 0 && createdGroups[item.groupIdx]) {
        await db.insert(schedules).values({
          scheduleDate: item.date,
          groupId: createdGroups[item.groupIdx].id,
          startTime: "08:00",
          endTime: "18:00",
          status: "scheduled",
          rotationPosition: item.rotPos,
          createdBy: admin.id,
        });
      }
    }

    console.log("==========================================");
    console.log("✓ Seeding successfully completed!");
    console.log("==========================================");
    process.exit(0);
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  }
}

seed();
