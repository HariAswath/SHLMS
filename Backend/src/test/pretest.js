import { db } from "../db/db.js";
import { laundryGroups, schedules, hostels, users } from "../db/schema.js";
import { eq } from "drizzle-orm";

async function pretest() {
  const [hostel] = await db.select().from(hostels).where(eq(hostels.id, 1)).limit(1);
  const [admin] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);

  if (!hostel) {
    console.error("No hostel found for pretest");
    process.exit(1);
  }

  const groupDefinitions = [
    { name: "Group 1", groupOrder: 1, roomRangeStart: "101", roomRangeEnd: "103" },
    { name: "Group 2", groupOrder: 2, roomRangeStart: "104", roomRangeEnd: "106" },
    { name: "Group 3", groupOrder: 3, roomRangeStart: "107", roomRangeEnd: "109" },
    { name: "Group 4", groupOrder: 4, roomRangeStart: "110", roomRangeEnd: "112" },
    { name: "Group 5", groupOrder: 5, roomRangeStart: "113", roomRangeEnd: "115" },
  ];

  // Always ensure clean group definitions for test run
  await db.delete(laundryGroups);

  const createdGroups = [];
  for (const g of groupDefinitions) {
    let [group] = await db
      .select()
      .from(laundryGroups)
      .where(eq(laundryGroups.groupOrder, g.groupOrder))
      .limit(1);

    if (!group) {
      [group] = await db
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
    createdGroups.push(group);
  }

  const sampleScheduleDates = [
    { date: "2026-09-21", groupIdx: 0, rotPos: 0 },
    { date: "2026-09-22", groupIdx: 1, rotPos: 1 },
    { date: "2026-09-23", groupIdx: 2, rotPos: 2 },
    { date: "2026-09-24", groupIdx: 3, rotPos: 3 },
    { date: "2026-09-26", groupIdx: 4, rotPos: 4 },
    { date: "2026-09-27", groupIdx: 0, rotPos: 0 },
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
        createdBy: admin?.id || 1,
      });
    }
  }

  process.exit(0);
}

pretest().catch((err) => {
  console.error("Pretest error:", err);
  process.exit(1);
});
