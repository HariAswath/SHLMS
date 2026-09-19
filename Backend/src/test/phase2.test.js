process.env.NODE_ENV = "test";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { env } from "../config/env.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { generateStudentBarcode, isValidStudentBarcode } from "../utils/barcode.js";
import {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  getUsersQuerySchema,
} from "../utils/validators/userValidators.js";
import jwt from "jsonwebtoken";
import app from "../app.js";

// Helper to make mock requests to express app
const makeRequest = async (method, url, { headers = {}, body = null } = {}) => {
  return new Promise((resolve) => {
    // Start temporary listener on free port
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

describe("Phase 2: Utilities & Validators", () => {
  it("should format and validate student barcodes correctly", () => {
    const barcode = generateStudentBarcode("23BCE9999");
    assert.equal(barcode, "VW-STU-23BCE9999");
    assert.equal(isValidStudentBarcode(barcode), true);
    assert.equal(isValidStudentBarcode("INVALID-CODE"), false);
  });

  it("should securely hash and verify passwords", async () => {
    const plain = "mypassword123";
    const hashed = await hashPassword(plain);
    assert.notEqual(hashed, plain);
    assert.ok(hashed.startsWith("$2"));

    const isMatch = await comparePassword(plain, hashed);
    assert.equal(isMatch, true);

    const isNotMatch = await comparePassword("wrongpassword", hashed);
    assert.equal(isNotMatch, false);
  });

  it("should validate createUserSchema with role-specific constraints", () => {
    // Valid student
    const validStudent = {
      name: "Test Student",
      email: "test.student@example.com",
      password: "password123",
      role: "student",
      studentId: "STU-100",
    };
    const res1 = createUserSchema.body.safeParse(validStudent);
    assert.equal(res1.success, true);

    // Student without studentId must fail
    const invalidStudent = {
      name: "Test Student",
      email: "test.student@example.com",
      password: "password123",
      role: "student",
    };
    const res2 = createUserSchema.body.safeParse(invalidStudent);
    assert.equal(res2.success, false);

    // Valid staff
    const validStaff = {
      name: "Test Staff",
      email: "test.staff@example.com",
      password: "password123",
      role: "staff",
      employeeId: "EMP-100",
    };
    const res3 = createUserSchema.body.safeParse(validStaff);
    assert.equal(res3.success, true);

    // Staff without employeeId must fail
    const invalidStaff = {
      name: "Test Staff",
      email: "test.staff@example.com",
      password: "password123",
      role: "staff",
    };
    const res4 = createUserSchema.body.safeParse(invalidStaff);
    assert.equal(res4.success, false);
  });
});

describe("Phase 2: User Routes Role-Based Authorization", () => {
  const studentToken = createToken({ id: 201, role: "student", email: "stu@test.com" });
  const staffToken = createToken({ id: 202, role: "staff", email: "staff@test.com" });
  const adminToken = createToken({ id: 1, role: "admin", email: "admin@vwash.com" });

  it("should forbid non-admin (student) from creating users (403)", async () => {
    const res = await makeRequest("POST", "/api/v1/users", {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        name: "Hacker",
        email: "hacker@test.com",
        password: "password123",
        role: "student",
        studentId: "STU-HACK",
      },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  it("should forbid non-admin (staff) from creating users (403)", async () => {
    const res = await makeRequest("POST", "/api/v1/users", {
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        name: "Staff Hacked",
        email: "staffhack@test.com",
        password: "password123",
        role: "staff",
        employeeId: "EMP-HACK",
      },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  it("should forbid student from listing all users (403)", async () => {
    const res = await makeRequest("GET", "/api/v1/users", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  it("should forbid student from viewing another user's profile (403)", async () => {
    const res = await makeRequest("GET", "/api/v1/users/1", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  it("should allow student to view their own profile via /users/:id (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/users/201", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    // If ID doesn't exist in test DB it returns 404, but NOT 403 Forbidden!
    assert.notEqual(res.status, 403);
  });

  it("should allow admin to list users with pagination (200)", async () => {
    const res = await makeRequest("GET", "/api/v1/users?page=1&limit=5", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.users));
    assert.ok(res.body.data.pagination);
    assert.equal(res.body.data.pagination.page, 1);
  });
});

describe("Phase 2: Admin CRUD Operations & Business Logic", () => {
  const adminToken = createToken({ id: 1, role: "admin", email: "admin@vwash.com" });
  const uniqueSuffix = Date.now().toString().slice(-6);

  let createdStudentId = null;
  let createdStaffId = null;

  it("should allow Admin to create a student with auto-generated barcode (201)", async () => {
    const payload = {
      name: "Phase 2 Student",
      email: `p2student_${uniqueSuffix}@vwash.com`,
      password: "password123",
      role: "student",
      studentId: `23BCE${uniqueSuffix}`,
      phone: "9876543210",
    };

    const res = await makeRequest("POST", "/api/v1/users", {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: payload,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.user.id);
    assert.equal(res.body.data.user.email, payload.email);
    assert.equal(res.body.data.user.role, "student");
    assert.equal(res.body.data.user.barcodeValue, `VW-STU-23BCE${uniqueSuffix}`);
    assert.equal(res.body.data.user.passwordHash, undefined, "passwordHash must never be returned");

    createdStudentId = res.body.data.user.id;
  });

  it("should reject creating another student with duplicate studentId (409)", async () => {
    const payload = {
      name: "Duplicate Student",
      email: `different_email_${uniqueSuffix}@vwash.com`,
      password: "password123",
      role: "student",
      studentId: `23BCE${uniqueSuffix}`, // Duplicate!
    };

    const res = await makeRequest("POST", "/api/v1/users", {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: payload,
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
  });

  it("should allow Admin to create a staff member (201)", async () => {
    const payload = {
      name: "Phase 2 Staff",
      email: `p2staff_${uniqueSuffix}@vwash.com`,
      password: "password123",
      role: "staff",
      employeeId: `EMP-${uniqueSuffix}`,
      phone: "9123456789",
    };

    const res = await makeRequest("POST", "/api/v1/users", {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: payload,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.role, "staff");
    assert.equal(res.body.data.user.employeeId, payload.employeeId);

    createdStaffId = res.body.data.user.id;
  });

  it("should allow Admin to update user details (200)", async () => {
    assert.ok(createdStudentId, "createdStudentId must exist");

    const res = await makeRequest("PATCH", `/api/v1/users/${createdStudentId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: "Updated Phase 2 Student Name",
        phone: "9998887776",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.name, "Updated Phase 2 Student Name");
    assert.equal(res.body.data.user.phone, "9998887776");
  });

  it("should allow Admin to deactivate and reactivate a user account (200)", async () => {
    assert.ok(createdStudentId, "createdStudentId must exist");

    // Deactivate
    const resDeactivate = await makeRequest("PATCH", `/api/v1/users/${createdStudentId}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: "inactive" },
    });

    assert.equal(resDeactivate.status, 200);
    assert.equal(resDeactivate.body.data.user.status, "inactive");

    // Reactivate
    const resActivate = await makeRequest("PATCH", `/api/v1/users/${createdStudentId}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: "active" },
    });

    assert.equal(resActivate.status, 200);
    assert.equal(resActivate.body.data.user.status, "active");
  });

  it("should prevent Admin from deactivating their own account (400)", async () => {
    const res = await makeRequest("PATCH", `/api/v1/users/1/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: "inactive" },
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /cannot deactivate your own/i);
  });
});
