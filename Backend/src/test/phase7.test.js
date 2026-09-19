process.env.NODE_ENV = "test";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { env } from "../config/env.js";
import { db } from "../db/db.js";
import { users } from "../db/schema.js";
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

describe("Phase 7: Reports Role-Based Authorization", async () => {
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

  it("should forbid student from accessing dashboard summary (403)", async () => {
    const res = await makeRequest("GET", "/api/v1/reports/dashboard", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("should forbid student from accessing laundry operational report (403)", async () => {
    const res = await makeRequest("GET", "/api/v1/reports/laundry", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("should forbid student from accessing complaints report (403)", async () => {
    const res = await makeRequest("GET", "/api/v1/reports/complaints", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("should forbid student from accessing feedback report (403)", async () => {
    const res = await makeRequest("GET", "/api/v1/reports/feedback", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("should forbid staff from accessing complaints report (403)", async () => {
    const res = await makeRequest("GET", "/api/v1/reports/complaints", {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("should forbid staff from accessing feedback satisfaction report (403)", async () => {
    const res = await makeRequest("GET", "/api/v1/reports/feedback", {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("should allow staff to access dashboard executive summary (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/reports/dashboard", {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it("should allow staff to access operational laundry report (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/reports/laundry", {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});

describe("Phase 7: Dashboard Summary & Operational Reports", async () => {
  let adminToken;

  before(async () => {
    const [admin] = await db.select().from(users).where(eq(users.email, "admin@vwash.com")).limit(1);
    adminToken = createToken(admin);
  });

  it("should return comprehensive dashboard metrics for Admin (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/reports/dashboard", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const { data } = res.body;
    // 1. Infrastructure checks
    assert(data.infrastructure.totalStudents >= 1);
    assert(data.infrastructure.totalStaff >= 1);
    assert(data.infrastructure.totalHostels >= 1);
    assert(data.infrastructure.totalRooms >= 1);
    assert(data.infrastructure.totalLaundryGroups >= 1);

    // 2. Operations checks
    assert(typeof data.laundryOperations.activeLaundry === "number");
    assert(typeof data.laundryOperations.totalProcessedAllTime === "number");

    // 3. Complaints checks
    assert(typeof data.complaints.total === "number");
    assert(typeof data.complaints.open === "number");

    // 4. Lost & Found checks
    assert(typeof data.lostAndFound.availableItems === "number");
    assert(typeof data.lostAndFound.pendingClaims === "number");

    // 5. Customer satisfaction checks
    assert(typeof data.customerSatisfaction.averageOverallRating === "number");
  });

  it("should return detailed laundry operational report with breakdown and trends (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/reports/laundry?startDate=2026-09-01&endDate=2026-09-30", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert(typeof res.body.data.summary.totalRecords === "number");
    assert(typeof res.body.data.summary.totalClothesCount === "number");
    assert(typeof res.body.data.summary.byStatus.received === "number");
    assert(typeof res.body.data.summary.byStatus.delivered === "number");
    assert(Array.isArray(res.body.data.dailyTrend));
    assert(Array.isArray(res.body.data.records));
  });

  it("should reject laundry report query with invalid date format (422)", async () => {
    const res = await makeRequest("GET", "/api/v1/reports/laundry?startDate=invalid-date", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 422);
    assert.equal(res.body.success, false);
  });

  it("should return complaints report with category breakdown and resolution rates (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/reports/complaints", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert(typeof res.body.data.summary.totalComplaints === "number");
    assert(typeof res.body.data.summary.byStatus.open === "number");
    assert(typeof res.body.data.summary.byStatus.resolved === "number");
    assert(typeof res.body.data.summary.byCategory.missing_clothes === "number");
    assert(typeof res.body.data.summary.resolutionRate === "string");
    assert(typeof res.body.data.summary.averageResolutionTimeHours === "number");
    assert(Array.isArray(res.body.data.complaints));
  });

  it("should return feedback satisfaction report with ratings distribution (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/reports/feedback", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert(typeof res.body.data.summary.totalReviews === "number");
    assert(typeof res.body.data.summary.averages.overall === "number");
    assert(typeof res.body.data.summary.averages.cleanliness === "number");
    assert(typeof res.body.data.summary.distribution["5"] === "number");
    assert(Array.isArray(res.body.data.feedback));
  });
});
