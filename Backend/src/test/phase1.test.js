process.env.NODE_ENV = "test";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { errorMiddleware } from "../middleware/errorMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import { authenticateToken, requireRole } from "../middleware/authMiddleware.js";
import * as schema from "../db/schema.js";
import * as relations from "../db/relations.js";
import { loginSchema } from "../utils/validators/authValidators.js";
import jwt from "jsonwebtoken";
import app from "../app.js";

describe("Phase 1: Foundation & Configuration", () => {
  it("should have valid environment configuration", () => {
    assert.ok(env.PORT, "PORT should be defined");
    assert.ok(env.NODE_ENV, "NODE_ENV should be defined");
    assert.ok(env.JWT_SECRET, "JWT_SECRET should be defined");
    assert.ok(env.JWT_REFRESH_SECRET, "JWT_REFRESH_SECRET should be defined");
  });

  it("should correctly instantiate AppError with statusCode and details", () => {
    const err = new AppError("Test error", 409, { reason: "duplicate" });
    assert.equal(err.message, "Test error");
    assert.equal(err.statusCode, 409);
    assert.deepEqual(err.details, { reason: "duplicate" });
    assert.equal(err.isOperational, true);
  });

  it("should format error responses uniformly in errorMiddleware", () => {
    const err = new AppError("Student is not scheduled today", 409);
    let responseStatus = null;
    let responseBody = null;

    const mockRes = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    errorMiddleware(err, { method: "POST", originalUrl: "/test" }, mockRes, () => {});

    assert.equal(responseStatus, 409);
    assert.equal(responseBody.success, false);
    assert.equal(responseBody.message, "Student is not scheduled today");
  });
});

describe("Phase 1: Zod Validation Middleware", () => {
  it("should pass validation for valid login data", () => {
    let nextCalled = false;
    const req = {
      body: {
        email: "student@vwash.com",
        password: "secretpassword",
      },
    };
    const res = {};
    const next = () => {
      nextCalled = true;
    };

    const middleware = validate(loginSchema);
    middleware(req, res, next);

    assert.equal(nextCalled, true);
  });

  it("should return 422 with structured errors for invalid email", () => {
    let responseStatus = null;
    let responseBody = null;
    const req = {
      body: {
        email: "not-an-email",
        password: "",
      },
    };
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };
    const next = () => {};

    const middleware = validate(loginSchema);
    middleware(req, res, next);

    assert.equal(responseStatus, 422);
    assert.equal(responseBody.success, false);
    assert.equal(responseBody.message, "Validation failed");
    assert.ok(Array.isArray(responseBody.errors));
    assert.ok(responseBody.errors.length > 0);
  });
});

describe("Phase 1: Authentication & Role Middleware", () => {
  it("should reject request without Authorization header with 401", () => {
    let responseStatus = null;
    let responseBody = null;
    const req = { headers: {} };
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    authenticateToken(req, res, next);

    assert.equal(responseStatus, 401);
    assert.equal(responseBody.success, false);
    assert.equal(responseBody.message, "Access token is missing");
    assert.equal(nextCalled, false);
  });

  it("should accept valid JWT and set req.user", () => {
    const payload = { id: 10, role: "admin", email: "admin@vwash.com" };
    const token = jwt.sign(payload, env.JWT_SECRET);

    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
    const res = {};
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    authenticateToken(req, res, next);

    assert.equal(nextCalled, true);
    assert.equal(req.user.id, 10);
    assert.equal(req.user.role, "admin");
    assert.equal(req.user.email, "admin@vwash.com");
  });

  it("should allow permitted role in requireRole", () => {
    const req = { user: { role: "admin" } };
    const res = {};
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    const guard = requireRole("admin", "staff");
    guard(req, res, next);

    assert.equal(nextCalled, true);
  });

  it("should block non-permitted role in requireRole with 403", () => {
    let responseStatus = null;
    let responseBody = null;
    const req = { user: { role: "student" } };
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    const guard = requireRole("admin", "staff");
    guard(req, res, next);

    assert.equal(responseStatus, 403);
    assert.equal(responseBody.success, false);
    assert.equal(responseBody.message, "Forbidden: You do not have the required permissions");
    assert.equal(nextCalled, false);
  });
});

describe("Phase 1: Database Schema & Relations Definition", () => {
  it("should export all 13 required tables", () => {
    const requiredTables = [
      "users",
      "hostels",
      "floors",
      "rooms",
      "laundryGroups",
      "schedules",
      "holidays",
      "laundryRecords",
      "complaints",
      "lostFound",
      "lostFoundClaims",
      "feedback",
      "notifications",
    ];

    for (const tableName of requiredTables) {
      assert.ok(schema[tableName], `Table '${tableName}' must be exported in schema.js`);
    }
  });

  it("should export all corresponding relations in relations.js", () => {
    const requiredRelations = [
      "usersRelations",
      "hostelsRelations",
      "floorsRelations",
      "roomsRelations",
      "laundryGroupsRelations",
      "schedulesRelations",
      "holidaysRelations",
      "laundryRecordsRelations",
      "complaintsRelations",
      "lostFoundRelations",
      "lostFoundClaimsRelations",
      "feedbackRelations",
      "notificationsRelations",
    ];

    for (const relationName of requiredRelations) {
      assert.ok(
        relations[relationName],
        `Relation '${relationName}' must be exported in relations.js`
      );
    }
  });
});
