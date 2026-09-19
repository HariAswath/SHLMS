process.env.NODE_ENV = "test";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { env } from "../config/env.js";
import { db } from "../db/db.js";
import { users, laundryRecords } from "../db/schema.js";
import { eq } from "drizzle-orm";
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

describe("Phase 5: Laundry Role-Based Authorization", async () => {
  let adminToken;
  let staffToken;
  let studentToken;

  before(async () => {
    const [admin] = await db.select().from(users).where(eq(users.email, "admin@vwash.com")).limit(1);
    const [staff] = await db.select().from(users).where(eq(users.email, "staff@vwash.com")).limit(1);
    const [student] = await db.select().from(users).where(eq(users.email, "student@vwash.com")).limit(1);

    adminToken = createToken(admin);
    staffToken = createToken(staff);
    studentToken = createToken(student);
  });

  it("should forbid student from verifying submissions (403)", async () => {
    const res = await makeRequest("POST", "/api/v1/laundry/verify-submission", {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { barcodeValue: "VW-STU-23BCE1234" },
    });
    assert.equal(res.status, 403);
  });

  it("should forbid student from recording laundry submission (403)", async () => {
    const res = await makeRequest("POST", "/api/v1/laundry/submit", {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        barcodeValue: "VW-STU-23BCE1234",
        clothDetails: { shirts: 2 },
      },
    });
    assert.equal(res.status, 403);
  });

  it("should forbid student from accessing today's operational queue (403)", async () => {
    const res = await makeRequest("GET", "/api/v1/laundry/today/queue", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("should forbid student from patching laundry status (403)", async () => {
    const res = await makeRequest("PATCH", "/api/v1/laundry/1/status", {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { status: "ready_for_pickup" },
    });
    assert.equal(res.status, 403);
  });

  it("should forbid student from verifying pickup (403)", async () => {
    const res = await makeRequest("POST", "/api/v1/laundry/1/verify-pickup", {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { barcodeValue: "VW-STU-23BCE1234" },
    });
    assert.equal(res.status, 403);
  });

  it("should forbid staff from calling student /my endpoint (403)", async () => {
    const res = await makeRequest("GET", "/api/v1/laundry/my", {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(res.status, 403);
  });
});

describe("Phase 5: Student Verification & Submission Validation", async () => {
  let staffToken;

  before(async () => {
    const [staff] = await db.select().from(users).where(eq(users.email, "staff@vwash.com")).limit(1);
    const [student] = await db.select().from(users).where(eq(users.email, "student@vwash.com")).limit(1);
    staffToken = createToken(staff);

    // Clean up any prior test laundry records for this student so verification can be tested cleanly
    if (student) {
      await db.delete(laundryRecords).where(eq(laundryRecords.studentId, student.id));
    }
  });

  it("should reject non-existent barcode QR (404)", async () => {
    const res = await makeRequest("POST", "/api/v1/laundry/verify-submission", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { barcodeValue: "VW-STU-DOESNOTEXIST" },
    });
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  it("should reject submission verification on a declared holiday (409)", async () => {
    // 2026-09-25 is seeded as a holiday
    const res = await makeRequest("POST", "/api/v1/laundry/verify-submission", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { barcodeValue: "VW-STU-23BCE1234", date: "2026-09-25" },
    });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /holiday/i);
  });

  it("should reject submission verification when student group does not match schedule (409)", async () => {
    // Sep 22 is scheduled for Group 2; student@vwash.com is in Room 101 (Group 1)
    const res = await makeRequest("POST", "/api/v1/laundry/verify-submission", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { barcodeValue: "VW-STU-23BCE1234", date: "2026-09-22" },
    });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /not scheduled today/i);
  });

  it("should approve student verification when student group matches schedule (200)", async () => {
    // Sep 21 is scheduled for Group 1; student@vwash.com is in Room 101 (Group 1)
    const res = await makeRequest("POST", "/api/v1/laundry/verify-submission", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { barcodeValue: "VW-STU-23BCE1234", date: "2026-09-21" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.eligible, true);
    assert.equal(res.body.data.student.barcodeValue, "VW-STU-23BCE1234");
    assert.equal(res.body.data.assignedGroup.name, "Group 1");
  });

  it("should reject submission when clothDetails is empty or total count is 0 (422)", async () => {
    const res = await makeRequest("POST", "/api/v1/laundry/submit", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        barcodeValue: "VW-STU-23BCE1234",
        date: "2026-09-21",
        clothDetails: { shirts: 0, pants: 0 },
      },
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.success, false);
  });
});

describe("Phase 5: Laundry Submission, Queue, Status Transitions & QR Pickup", async () => {
  let staffToken;
  let studentToken;
  let adminToken;
  let createdLaundryRecordId;
  let studentUser;

  before(async () => {
    const [admin] = await db.select().from(users).where(eq(users.email, "admin@vwash.com")).limit(1);
    const [staff] = await db.select().from(users).where(eq(users.email, "staff@vwash.com")).limit(1);
    const [student] = await db.select().from(users).where(eq(users.email, "student@vwash.com")).limit(1);

    studentUser = student;
    adminToken = createToken(admin);
    staffToken = createToken(staff);
    studentToken = createToken(student);

    // Clean up any prior test laundry records for this student
    await db.delete(laundryRecords).where(eq(laundryRecords.studentId, student.id));
  });

  it("should successfully record laundry submission with clothDetails and notify student (201)", async () => {
    const res = await makeRequest("POST", "/api/v1/laundry/submit", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        barcodeValue: "VW-STU-23BCE1234",
        date: "2026-09-21",
        clothDetails: {
          shirts: 3,
          pants: 2,
          bedsheet: 1,
        },
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.laundryRecord.status, "received");
    assert.equal(res.body.data.laundryRecord.studentId, studentUser.id);
    createdLaundryRecordId = res.body.data.laundryRecord.id;
  });

  it("should reject duplicate laundry submission for same student on same schedule (409)", async () => {
    const res = await makeRequest("POST", "/api/v1/laundry/submit", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        barcodeValue: "VW-STU-23BCE1234",
        date: "2026-09-21",
        clothDetails: {
          shirts: 1,
        },
      },
    });

    assert.equal(res.status, 409);
    assert.match(res.body.message, /already submitted laundry/i);
  });

  it("should retrieve operational queue with real-time statistics (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/laundry/today/queue?date=2026-09-21", {
      headers: { Authorization: `Bearer ${staffToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert(res.body.data.statistics.submitted >= 1);
    assert(res.body.data.queue.length >= 1);
  });

  it("should allow student to view their own laundry history via /my (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/laundry/my", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert(Array.isArray(res.body.data.records));
    const found = res.body.data.records.some((r) => r.id === createdLaundryRecordId);
    assert.equal(found, true);
  });

  it("should allow viewing single laundry record by ID (200)", async () => {
    const res = await makeRequest("GET", `/api/v1/laundry/${createdLaundryRecordId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.record.id, createdLaundryRecordId);
    assert.equal(res.body.data.record.student.barcodeValue, "VW-STU-23BCE1234");
  });

  it("should advance status from received to ready_for_pickup (200)", async () => {
    const res = await makeRequest("PATCH", `/api/v1/laundry/${createdLaundryRecordId}/status`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: "ready_for_pickup" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.record.status, "ready_for_pickup");
    assert(res.body.data.record.readyAt !== null);
  });

  it("should reject invalid backward status transition ready_for_pickup -> received (400)", async () => {
    const res = await makeRequest("PATCH", `/api/v1/laundry/${createdLaundryRecordId}/status`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: "received" },
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /invalid status transition/i);
  });

  it("should reject pickup verification if wrong student QR is scanned (409)", async () => {
    // Scanned barcode belongs to Arun (VW-STU-23BCE1002), but laundry belongs to Hari
    const res = await makeRequest("POST", `/api/v1/laundry/${createdLaundryRecordId}/verify-pickup`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { barcodeValue: "VW-STU-23BCE1002" },
    });

    assert.equal(res.status, 409);
    assert.match(res.body.message, /belongs to another student/i);
  });

  it("should verify pickup with matching student QR code and mark delivered (200)", async () => {
    const res = await makeRequest("POST", `/api/v1/laundry/${createdLaundryRecordId}/verify-pickup`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { barcodeValue: "VW-STU-23BCE1234" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.record.status, "delivered");
    assert(res.body.data.record.deliveredAt !== null);
    assert(res.body.data.record.pickupVerifiedAt !== null);
  });

  it("should reject pickup verification on already delivered laundry (409)", async () => {
    const res = await makeRequest("POST", `/api/v1/laundry/${createdLaundryRecordId}/verify-pickup`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { barcodeValue: "VW-STU-23BCE1234" },
    });

    assert.equal(res.status, 409);
    assert.match(res.body.message, /already been delivered/i);
  });

  it("should reject backward status transition from delivered -> ready_for_pickup (400)", async () => {
    const res = await makeRequest("PATCH", `/api/v1/laundry/${createdLaundryRecordId}/status`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: "ready_for_pickup" },
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /delivered laundry cannot be reverted/i);
  });
});
