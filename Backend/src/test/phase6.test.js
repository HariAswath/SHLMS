process.env.NODE_ENV = "test";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { env } from "../config/env.js";
import { db } from "../db/db.js";
import { users, laundryRecords, complaints, lostFound, lostFoundClaims, feedback, notifications } from "../db/schema.js";
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

describe("Phase 6: Complaints Module", async () => {
  let adminToken;
  let staffToken;
  let student1Token;
  let student2Token;
  let student1;
  let student2;
  let createdComplaintId;

  before(async () => {
    const [admin] = await db.select().from(users).where(eq(users.email, "admin@vwash.com")).limit(1);
    const [staff] = await db.select().from(users).where(eq(users.email, "staff@vwash.com")).limit(1);
    const [s1] = await db.select().from(users).where(eq(users.email, "student@vwash.com")).limit(1);
    const [s2] = await db.select().from(users).where(eq(users.email, "arun@vwash.com")).limit(1);

    student1 = s1;
    student2 = s2;
    adminToken = createToken(admin);
    staffToken = createToken(staff);
    student1Token = createToken(s1);
    student2Token = createToken(s2);
  });

  it("should reject creating complaint with invalid category or short description (422)", async () => {
    const res = await makeRequest("POST", "/api/v1/complaints", {
      headers: { Authorization: `Bearer ${student1Token}` },
      body: {
        category: "invalid_category",
        description: "bad",
      },
    });

    assert.equal(res.status, 422);
    assert.equal(res.body.success, false);
  });

  it("should allow student to submit a valid complaint (201)", async () => {
    const res = await makeRequest("POST", "/api/v1/complaints", {
      headers: { Authorization: `Bearer ${student1Token}` },
      body: {
        category: "missing_clothes",
        description: "Blue striped shirt was missing from yesterday's delivery.",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.complaint.status, "open");
    assert.equal(res.body.data.complaint.studentId, student1.id);
    createdComplaintId = res.body.data.complaint.id;
  });

  it("should allow student to list their own complaints (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/complaints", {
      headers: { Authorization: `Bearer ${student1Token}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert(res.body.data.complaints.some((c) => c.id === createdComplaintId));
  });

  it("should forbid another student from viewing this complaint by ID (403)", async () => {
    const res = await makeRequest("GET", `/api/v1/complaints/${createdComplaintId}`, {
      headers: { Authorization: `Bearer ${student2Token}` },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  it("should allow Admin to view any complaint by ID (200)", async () => {
    const res = await makeRequest("GET", `/api/v1/complaints/${createdComplaintId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.complaint.id, createdComplaintId);
  });

  it("should forbid staff from updating complaint status (403)", async () => {
    const res = await makeRequest("PATCH", `/api/v1/complaints/${createdComplaintId}/status`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: "under_review" },
    });

    assert.equal(res.status, 403);
  });

  it("should allow Admin to update complaint status and add remarks (200)", async () => {
    const res = await makeRequest("PATCH", `/api/v1/complaints/${createdComplaintId}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: "resolved",
        adminRemarks: "Item found in dryer area and handed over to student.",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.complaint.status, "resolved");
    assert.equal(res.body.data.complaint.adminRemarks, "Item found in dryer area and handed over to student.");
  });
});

describe("Phase 6: Lost & Found Module", async () => {
  let adminToken;
  let staffToken;
  let student1Token;
  let student2Token;
  let student1;
  let createdItemId;
  let createdClaimId;

  before(async () => {
    const [admin] = await db.select().from(users).where(eq(users.email, "admin@vwash.com")).limit(1);
    const [staff] = await db.select().from(users).where(eq(users.email, "staff@vwash.com")).limit(1);
    const [s1] = await db.select().from(users).where(eq(users.email, "student@vwash.com")).limit(1);
    const [s2] = await db.select().from(users).where(eq(users.email, "arun@vwash.com")).limit(1);

    student1 = s1;
    adminToken = createToken(admin);
    staffToken = createToken(staff);
    student1Token = createToken(s1);
    student2Token = createToken(s2);
  });

  it("should forbid student from uploading lost & found items (403)", async () => {
    const res = await makeRequest("POST", "/api/v1/lost-found", {
      headers: { Authorization: `Bearer ${student1Token}` },
      body: {
        title: "Nike Hoodie",
        category: "jacket",
      },
    });

    assert.equal(res.status, 403);
  });

  it("should allow staff to upload a lost & found item (201)", async () => {
    const res = await makeRequest("POST", "/api/v1/lost-found", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        title: "Black Adidas Track Pants",
        category: "pants",
        color: "Black with white stripes",
        description: "Found in washing machine #4 after cycle.",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.item.status, "available");
    createdItemId = res.body.data.item.id;
  });

  it("should allow all authenticated users to browse lost & found items (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/lost-found?category=pants", {
      headers: { Authorization: `Bearer ${student1Token}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert(res.body.data.items.some((i) => i.id === createdItemId));
  });

  it("should allow student to submit a claim for an available item (201)", async () => {
    const res = await makeRequest("POST", `/api/v1/lost-found/${createdItemId}/claim`, {
      headers: { Authorization: `Bearer ${student1Token}` },
      body: {
        description: "Size M Adidas track pants with slight tear on left pocket seam.",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.claim.status, "pending");
    createdClaimId = res.body.data.claim.id;
  });

  it("should reject duplicate claim on same item from same student (409)", async () => {
    const res = await makeRequest("POST", `/api/v1/lost-found/${createdItemId}/claim`, {
      headers: { Authorization: `Bearer ${student1Token}` },
      body: {
        description: "Trying to claim again.",
      },
    });

    assert.equal(res.status, 409);
    assert.match(res.body.message, /already have an active pending claim/i);
  });

  it("should forbid non-admin from reviewing claims (403)", async () => {
    const res = await makeRequest("PATCH", `/api/v1/lost-found/claims/${createdClaimId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: "approved" },
    });

    assert.equal(res.status, 403);
  });

  it("should allow Admin to approve claim, updating item status to claimed (200)", async () => {
    const res = await makeRequest("PATCH", `/api/v1/lost-found/claims/${createdClaimId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: "approved",
        remarks: "Ownership verified against student room number and description.",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.claim.status, "approved");

    // Verify item status updated to claimed
    const itemRes = await makeRequest("GET", `/api/v1/lost-found/${createdItemId}`, {
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    assert.equal(itemRes.body.data.item.status, "claimed");
  });
});

describe("Phase 6: Feedback Module", async () => {
  let adminToken;
  let staffToken;
  let student1Token;
  let student2Token;
  let student1;
  let deliveredLaundryRecord;

  before(async () => {
    const [admin] = await db.select().from(users).where(eq(users.email, "admin@vwash.com")).limit(1);
    const [staff] = await db.select().from(users).where(eq(users.email, "staff@vwash.com")).limit(1);
    const [s1] = await db.select().from(users).where(eq(users.email, "student@vwash.com")).limit(1);
    const [s2] = await db.select().from(users).where(eq(users.email, "arun@vwash.com")).limit(1);

    student1 = s1;
    adminToken = createToken(admin);
    staffToken = createToken(staff);
    student1Token = createToken(s1);
    student2Token = createToken(s2);

    // Find or create a delivered laundry record for student1
    let [rec] = await db
      .select()
      .from(laundryRecords)
      .where(eq(laundryRecords.studentId, s1.id))
      .limit(1);

    if (!rec) {
      [rec] = await db
        .insert(laundryRecords)
        .values({
          studentId: s1.id,
          status: "delivered",
          clothDetails: { shirts: 2 },
          deliveredAt: new Date(),
        })
        .returning();
    } else if (rec.status !== "delivered") {
      [rec] = await db
        .update(laundryRecords)
        .set({ status: "delivered", deliveredAt: new Date() })
        .where(eq(laundryRecords.id, rec.id))
        .returning();
    }

    deliveredLaundryRecord = rec;

    // Clean any prior feedback for this laundry record to keep test idempotent
    await db.delete(feedback).where(eq(feedback.laundryId, deliveredLaundryRecord.id));
  });

  it("should forbid staff or admin from submitting student feedback (403)", async () => {
    const res = await makeRequest("POST", "/api/v1/feedback", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        laundryId: deliveredLaundryRecord.id,
        cleanlinessRating: 5,
        timelinessRating: 5,
        staffServiceRating: 5,
        overallRating: 5,
      },
    });

    assert.equal(res.status, 403);
  });

  it("should forbid student from submitting feedback for another student's laundry (403)", async () => {
    const res = await makeRequest("POST", "/api/v1/feedback", {
      headers: { Authorization: `Bearer ${student2Token}` },
      body: {
        laundryId: deliveredLaundryRecord.id,
        cleanlinessRating: 4,
        timelinessRating: 4,
        staffServiceRating: 4,
        overallRating: 4,
      },
    });

    assert.equal(res.status, 403);
  });

  it("should allow student to submit feedback for their delivered laundry (201)", async () => {
    const res = await makeRequest("POST", "/api/v1/feedback", {
      headers: { Authorization: `Bearer ${student1Token}` },
      body: {
        laundryId: deliveredLaundryRecord.id,
        cleanlinessRating: 5,
        timelinessRating: 4,
        staffServiceRating: 5,
        overallRating: 5,
        comment: "Excellent and quick service today!",
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.feedback.overallRating, 5);
  });

  it("should reject duplicate feedback for the same laundry record (409)", async () => {
    const res = await makeRequest("POST", "/api/v1/feedback", {
      headers: { Authorization: `Bearer ${student1Token}` },
      body: {
        laundryId: deliveredLaundryRecord.id,
        cleanlinessRating: 3,
        timelinessRating: 3,
        staffServiceRating: 3,
        overallRating: 3,
      },
    });

    assert.equal(res.status, 409);
    assert.match(res.body.message, /already been submitted/i);
  });

  it("should forbid student from accessing feedback analytics (403)", async () => {
    const res = await makeRequest("GET", "/api/v1/feedback/analytics", {
      headers: { Authorization: `Bearer ${student1Token}` },
    });

    assert.equal(res.status, 403);
  });

  it("should allow Admin to view feedback list and analytics (200)", async () => {
    const listRes = await makeRequest("GET", "/api/v1/feedback", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listRes.status, 200);
    assert(listRes.body.data.feedback.length >= 1);

    const analyticsRes = await makeRequest("GET", "/api/v1/feedback/analytics", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(analyticsRes.status, 200);
    assert(analyticsRes.body.data.totalReviews >= 1);
    assert.equal(typeof analyticsRes.body.data.averages.overall, "number");
    assert.equal(typeof analyticsRes.body.data.distribution["5"], "number");
  });
});

describe("Phase 6: Notifications Module", async () => {
  let student1Token;
  let student1;
  let createdNotificationId;

  before(async () => {
    const [s1] = await db.select().from(users).where(eq(users.email, "student@vwash.com")).limit(1);
    student1 = s1;
    student1Token = createToken(s1);

    // Seed a test unread notification for student1
    const [n] = await db
      .insert(notifications)
      .values({
        userId: s1.id,
        type: "laundry_ready",
        title: "Test Laundry Ready",
        message: "Your laundry is waiting for collection.",
        isRead: false,
      })
      .returning();

    createdNotificationId = n.id;
  });

  it("should allow user to view their notifications with unread count (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/notifications", {
      headers: { Authorization: `Bearer ${student1Token}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert(res.body.data.unreadCount >= 1);
    assert(res.body.data.notifications.some((n) => n.id === createdNotificationId));
  });

  it("should allow user to mark a specific notification as read (200)", async () => {
    const res = await makeRequest("PATCH", `/api/v1/notifications/${createdNotificationId}/read`, {
      headers: { Authorization: `Bearer ${student1Token}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.notification.isRead, true);
  });

  it("should allow user to mark all notifications as read (200)", async () => {
    const res = await makeRequest("PATCH", "/api/v1/notifications/read-all", {
      headers: { Authorization: `Bearer ${student1Token}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});
