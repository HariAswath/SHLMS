process.env.NODE_ENV = "test";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { env } from "../config/env.js";
import { db } from "../db/db.js";
import {
  users,
  schedules,
  laundryRecords,
  complaints,
  lostFound,
  lostFoundClaims,
  feedback,
  notifications,
} from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";
import app from "../app.js";

// Helper to make mock requests to express app with cookie support
const makeRequest = async (method, url, { headers = {}, body = null, cookies = null } = {}) => {
  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      const targetUrl = `http://localhost:${port}${url}`;

      const reqHeaders = {
        "Content-Type": "application/json",
        ...headers,
      };

      if (cookies) {
        reqHeaders["Cookie"] = cookies;
      }

      const options = {
        method,
        headers: reqHeaders,
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      try {
        const response = await fetch(targetUrl, options);
        const data = await response.json().catch(() => null);
        const setCookie = response.headers.get("set-cookie");
        server.close(() => {
          resolve({ status: response.status, body: data, headers: response.headers, setCookie });
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

describe("Phase 8: Authentication Lifecycle & Token Security", () => {
  let refreshTokenCookie;
  let accessToken;

  it("should authenticate student with valid credentials and issue tokens (200)", async () => {
    const res = await makeRequest("POST", "/api/v1/auth/login", {
      body: {
        email: "student@vwash.com",
        password: "student123",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    assert.equal(res.body.data.user.email, "student@vwash.com");
    assert.equal(res.body.data.user.role, "student");
    assert.ok(res.setCookie, "Should set HTTP-only refresh cookie");
    assert.match(res.setCookie, /refreshToken=/);

    accessToken = res.body.data.accessToken;
    refreshTokenCookie = res.setCookie.split(";")[0];
  });

  it("should reject authentication with invalid password (401)", async () => {
    const res = await makeRequest("POST", "/api/v1/auth/login", {
      body: {
        email: "student@vwash.com",
        password: "wrongpassword",
      },
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it("should reject authentication for non-existent email (401)", async () => {
    const res = await makeRequest("POST", "/api/v1/auth/login", {
      body: {
        email: "unknown@vwash.com",
        password: "password123",
      },
    });

    assert.equal(res.status, 401);
  });

  it("should allow student to verify session profile via /auth/me (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, "student@vwash.com");
  });

  it("should successfully rotate/refresh access token using refresh cookie (200)", async () => {
    const res = await makeRequest("POST", "/api/v1/auth/refresh", {
      cookies: refreshTokenCookie,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.accessToken);
  });

  it("should clear refresh cookie on logout (200)", async () => {
    const res = await makeRequest("POST", "/api/v1/auth/logout");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.match(res.setCookie, /refreshToken=;/);
  });
});

describe("Phase 8: Complete End-to-End System Operational Lifecycle", () => {
  let adminToken;
  let staffToken;
  let studentToken;
  let studentUser;
  let activeLaundryId;
  let filedComplaintId;
  let foundItemId;
  let claimId;

  before(async () => {
    const [admin] = await db.select().from(users).where(eq(users.email, "admin@vwash.com")).limit(1);
    const [staff] = await db.select().from(users).where(eq(users.email, "staff@vwash.com")).limit(1);
    const [student] = await db.select().from(users).where(eq(users.email, "student@vwash.com")).limit(1);

    studentUser = student;
    adminToken = createToken(admin);
    staffToken = createToken(staff);
    studentToken = createToken(student);

    // Clean any existing feedback, complaints, and laundry records for student to ensure clean state
    await db.delete(feedback).where(eq(feedback.studentId, student.id));
    await db.delete(complaints).where(eq(complaints.studentId, student.id));
    await db.delete(laundryRecords).where(eq(laundryRecords.studentId, student.id));
  });

  it("Step 1: Student checks assigned round-robin schedule (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/schedules/my", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.assignedGroup);
  });

  it("Step 2: Staff scans student QR on scheduled day (Sep 27) to verify eligibility (200)", async () => {
    const res = await makeRequest("POST", "/api/v1/laundry/verify-submission", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        barcodeValue: "VW-STU-23BCE1234",
        date: "2026-09-27",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.eligible, true);
    assert.equal(res.body.data.student.barcodeValue, "VW-STU-23BCE1234");
  });

  it("Step 3: Staff records laundry collection and clothes count (201)", async () => {
    const res = await makeRequest("POST", "/api/v1/laundry/submit", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        barcodeValue: "VW-STU-23BCE1234",
        date: "2026-09-27",
        clothDetails: {
          shirts: 4,
          pants: 2,
          tshirts: 3,
          towel: 1,
        },
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.laundryRecord.status, "received");
    activeLaundryId = res.body.data.laundryRecord.id;
  });

  it("Step 4: Staff views counter queue and verifies student laundry is queued (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/laundry/today/queue?date=2026-09-27", {
      headers: { Authorization: `Bearer ${staffToken}` },
    });

    assert.equal(res.status, 200);
    assert(res.body.data.statistics.submitted >= 1);
    assert(res.body.data.queue.some((item) => item.id === activeLaundryId));
  });

  it("Step 5: Staff updates status to ready_for_pickup upon wash completion (200)", async () => {
    const res = await makeRequest("PATCH", `/api/v1/laundry/${activeLaundryId}/status`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: "ready_for_pickup" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.record.status, "ready_for_pickup");
  });

  it("Step 6: Student arrives at counter and QR is scanned to hand over laundry (200)", async () => {
    const res = await makeRequest("POST", `/api/v1/laundry/${activeLaundryId}/verify-pickup`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { barcodeValue: "VW-STU-23BCE1234" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.record.status, "delivered");
    assert.ok(res.body.data.record.deliveredAt);
    assert.ok(res.body.data.record.pickupVerifiedAt);
  });

  it("Step 7: Student rates the completed service and leaves feedback (201)", async () => {
    const res = await makeRequest("POST", "/api/v1/feedback", {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        laundryId: activeLaundryId,
        cleanlinessRating: 5,
        timelinessRating: 5,
        staffServiceRating: 4,
        overallRating: 5,
        comment: "Flawless turnaround and clean folding. Thank you!",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.feedback.overallRating, 5);
  });

  it("Step 8: Student files a complaint for a damaged towel (201)", async () => {
    const res = await makeRequest("POST", "/api/v1/complaints", {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        laundryId: activeLaundryId,
        category: "damaged_clothes",
        description: "White bath towel has slight chemical discoloration on border.",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.complaint.status, "open");
    filedComplaintId = res.body.data.complaint.id;
  });

  it("Step 9: Admin investigates and resolves the complaint (200)", async () => {
    const res = await makeRequest("PATCH", `/api/v1/complaints/${filedComplaintId}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: "resolved",
        adminRemarks: "Replacement towel provided from hostel store inventory.",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.complaint.status, "resolved");
  });

  it("Step 10: Staff uploads item to Lost & Found (201)", async () => {
    const res = await makeRequest("POST", "/api/v1/lost-found", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        title: "Puma Sports Watch",
        category: "accessory",
        color: "Blue",
        description: "Found inside pocket of laundry basket #12.",
      },
    });

    assert.equal(res.status, 201);
    foundItemId = res.body.data.item.id;
  });

  it("Step 11: Student submits ownership claim for Lost & Found item (201)", async () => {
    const res = await makeRequest("POST", `/api/v1/lost-found/${foundItemId}/claim`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        description: "Blue Puma digital watch with scratched display glass.",
      },
    });

    assert.equal(res.status, 201);
    claimId = res.body.data.claim.id;
  });

  it("Step 12: Admin approves the Lost & Found claim (200)", async () => {
    const res = await makeRequest("PATCH", `/api/v1/lost-found/claims/${claimId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: "approved",
        remarks: "Student verified watch serial number.",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.claim.status, "approved");
  });

  it("Step 13: Student reads and clears all notifications (200)", async () => {
    const getRes = await makeRequest("GET", "/api/v1/notifications", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(getRes.status, 200);
    assert(getRes.body.data.total >= 1);

    const clearRes = await makeRequest("PATCH", "/api/v1/notifications/read-all", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(clearRes.status, 200);
  });

  it("Step 14: Admin reviews live executive dashboard and reports (200)", async () => {
    const dashRes = await makeRequest("GET", "/api/v1/reports/dashboard", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(dashRes.status, 200);
    assert(dashRes.body.data.laundryOperations.totalProcessedAllTime >= 1);
    assert(dashRes.body.data.customerSatisfaction.totalReviews >= 1);
  });
});
