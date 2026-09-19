process.env.NODE_ENV = "test";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { env } from "../config/env.js";
import { getDateRange } from "../utils/scheduler.js";
import jwt from "jsonwebtoken";
import app from "../app.js";

// Helper to make mock requests to express app
const makeRequest = async (method, url, { headers = {}, body = null } = {}) => {
  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      const targetUrl = `http://localhost:${port}${url}`;

      const options = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      try {
        const response = await fetch(targetUrl, options);
        const data = await response.json().catch(() => null);
        server.close(() => {
          resolve({ status: response.status, body: data });
        });
      } catch (err) {
        server.close(() => {
          resolve({ status: 500, error: err });
        });
      }
    });
  });
};

const createToken = (user) => {
  return jwt.sign(
    { id: user.id, sub: user.id, role: user.role, email: user.email, name: user.name },
    env.JWT_SECRET,
    { expiresIn: "1h" }
  );
};

describe("Phase 4: Scheduler Utilities & Date Math", () => {
  it("should generate continuous ISO date range", () => {
    const dates = getDateRange("2026-10-01", "2026-10-05");
    assert.deepEqual(dates, [
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
    ]);
  });
});

describe("Phase 4: Scheduling Role-Based Authorization", () => {
  const adminToken = createToken({ id: 1, role: "admin", email: "admin@vwash.com" });
  const studentToken = createToken({ id: 3, role: "student", email: "student@vwash.com" });
  const staffToken = createToken({ id: 2, role: "staff", email: "staff@vwash.com" });

  it("should forbid non-admin from generating schedules (403)", async () => {
    const res = await makeRequest("POST", "/api/v1/schedules", {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { startDate: "2026-11-01", endDate: "2026-11-05" },
    });
    assert.equal(res.status, 403);
  });

  it("should forbid non-admin from creating holidays (403)", async () => {
    const res = await makeRequest("POST", "/api/v1/schedules/holidays", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { date: "2026-11-15", reason: "Staff holiday" },
    });
    assert.equal(res.status, 403);
  });

  it("should forbid non-admin from patching schedules (403)", async () => {
    const res = await makeRequest("PATCH", "/api/v1/schedules/1", {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { status: "cancelled" },
    });
    assert.equal(res.status, 403);
  });

  it("should forbid staff or admin from calling /schedules/my (403)", async () => {
    const res = await makeRequest("GET", "/api/v1/schedules/my", {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(res.status, 403);
  });
});

describe("Phase 4: Holiday Management & Auto-Shift", () => {
  const adminToken = createToken({ id: 1, role: "admin", email: "admin@vwash.com" });
  const studentToken = createToken({ id: 3, role: "student", email: "student@vwash.com" });

  const randYear = 2030 + Math.floor(Math.random() * 50);
  const randMonth = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
  const randDay = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
  const holidayDate = `${randYear}-${randMonth}-${randDay}`;

  it("should allow Admin to create a holiday (201)", async () => {
    const res = await makeRequest("POST", "/api/v1/schedules/holidays", {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        date: holidayDate,
        reason: "Winter Hostel Festival",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.holiday.date, holidayDate);
  });

  it("should reject duplicate holiday date (409)", async () => {
    const res = await makeRequest("POST", "/api/v1/schedules/holidays", {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        date: holidayDate,
        reason: "Duplicate Festival",
      },
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
  });

  it("should allow authenticated users to view holidays (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/schedules/holidays", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.holidays));
  });
});

describe("Phase 4: Round-Robin Schedule Generation & Holiday Freeze", () => {
  const adminToken = createToken({ id: 1, role: "admin", email: "admin@vwash.com" });
  const studentToken = createToken({ id: 3, role: "student", email: "student@vwash.com" });

  // Generate for November 2026
  const start = "2026-11-01";
  const end = "2026-11-07"; // 7 days

  let generatedScheduleId = null;

  it("should automate schedule generation for date range skipping holidays (201)", async () => {
    // 1. Mark Nov 05 as a holiday first to test the freeze
    await makeRequest("POST", "/api/v1/schedules/holidays", {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { date: "2026-11-05", reason: "Hostel Maintenance Day" },
    });

    // 2. Automate schedule generation for Nov 1 to Nov 7 (7 calendar days, 1 holiday = 6 schedules)
    const res = await makeRequest("POST", "/api/v1/schedules", {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        startDate: start,
        endDate: end,
        hostelId: 1,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.totalGenerated, 6, "Should generate exactly 6 schedules for 7 days with 1 holiday");

    const scheds = res.body.data.schedules;
    assert.ok(scheds.length > 0);
    generatedScheduleId = scheds[0].id;

    // Verify Nov 05 was skipped
    const nov5 = scheds.find((s) => s.scheduleDate === "2026-11-05");
    assert.equal(nov5, undefined, "Holiday date must have no normal schedule allocation");

    // Fetch active groups count for hostel 1
    const groupRes = await makeRequest("GET", "/api/v1/laundry-groups?hostelId=1", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const totalGroups = groupRes.body.data.groups.length;

    // Verify continuous rotation positions
    const posList = scheds.map((s) => s.rotationPosition);
    for (let i = 0; i < posList.length - 1; i++) {
      const nextExpected = (posList[i] + 1) % totalGroups;
      assert.equal(posList[i + 1], nextExpected, "Rotation must advance continuously without skipping any group");
    }
  });

  it("should allow viewing today's schedule (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/schedules/today", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.date);
  });

  it("should allow student to query their assigned schedule via /schedules/my (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/schedules/my", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.student);
    assert.ok(res.body.data.assignedGroup);
    assert.ok("isScheduledToday" in res.body.data);
  });

  it("should allow viewing upcoming schedules for N days (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/schedules/upcoming?days=7", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.schedules));
    assert.ok(Array.isArray(res.body.data.holidays));
  });

  it("should allow Admin to make an audited patch correction to a schedule (200)", async () => {
    assert.ok(generatedScheduleId);

    const res = await makeRequest("PATCH", `/api/v1/schedules/${generatedScheduleId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        startTime: "09:00",
        endTime: "17:00",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.schedule.startTime, "09:00");
    assert.equal(res.body.data.schedule.endTime, "17:00");
  });
});
