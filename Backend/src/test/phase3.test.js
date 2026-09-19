process.env.NODE_ENV = "test";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { env } from "../config/env.js";
import { resolveGroupByRoom } from "../utils/groupResolver.js";
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

describe("Phase 3: Room-to-Group Resolver", () => {
  it("should resolve seeded rooms to their correct laundry groups", async () => {
    // In seed: Hostel 1 has G1 (101-103), G2 (104-106), G3 (107-109)
    const g1 = await resolveGroupByRoom(1, "102");
    assert.ok(g1, "Room 102 should resolve to a group");
    assert.equal(g1.name, "Group 1");

    const g2 = await resolveGroupByRoom(1, "105");
    assert.ok(g2, "Room 105 should resolve to a group");
    assert.equal(g2.name, "Group 2");

    const gNull = await resolveGroupByRoom(1, "999");
    assert.equal(gNull, null, "Room 999 should not match any group");
  });
});

describe("Phase 3: Hostel Block, Floor & Room Management", () => {
  const adminToken = createToken({ id: 1, role: "admin", email: "admin@vwash.com" });
  const studentToken = createToken({ id: 2, role: "student", email: "student@vwash.com" });

  const uniqueSuffix = Date.now().toString().slice(-5);
  let createdHostelId = null;
  let createdFloorId = null;

  it("should forbid non-admin from creating hostels (403)", async () => {
    const res = await makeRequest("POST", "/api/v1/hostels", {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { name: "Illegal Block", code: `BLK-${uniqueSuffix}` },
    });
    assert.equal(res.status, 403);
  });

  it("should allow Admin to create a new hostel block (201)", async () => {
    const res = await makeRequest("POST", "/api/v1/hostels", {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { name: `Hostel Block ${uniqueSuffix}`, code: `H-${uniqueSuffix}` },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.hostel.id);
    assert.equal(res.body.data.hostel.code, `H-${uniqueSuffix}`);

    createdHostelId = res.body.data.hostel.id;
  });

  it("should reject duplicate hostel code (409)", async () => {
    const res = await makeRequest("POST", "/api/v1/hostels", {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { name: "Duplicate Block", code: `H-${uniqueSuffix}` },
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
  });

  it("should allow Admin to create a floor in the hostel (201)", async () => {
    assert.ok(createdHostelId);

    const res = await makeRequest("POST", `/api/v1/hostels/${createdHostelId}/floors`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { floorNumber: 1, name: "First Floor" },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.floor.floorNumber, 1);

    createdFloorId = res.body.data.floor.id;
  });

  it("should reject duplicate floor number in the same hostel (409)", async () => {
    assert.ok(createdHostelId);

    const res = await makeRequest("POST", `/api/v1/hostels/${createdHostelId}/floors`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { floorNumber: 1, name: "First Floor Again" },
    });

    assert.equal(res.status, 409);
  });

  it("should allow Admin to create a single room (201)", async () => {
    assert.ok(createdHostelId && createdFloorId);

    const res = await makeRequest("POST", `/api/v1/hostels/${createdHostelId}/rooms`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { floorId: createdFloorId, roomNumber: "101" },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.room.roomNumber, "101");
  });

  it("should allow Admin to bulk create rooms in a range (201)", async () => {
    assert.ok(createdHostelId && createdFloorId);

    const res = await makeRequest("POST", `/api/v1/hostels/${createdHostelId}/rooms/bulk`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { floorId: createdFloorId, startRoom: 102, endRoom: 110 },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.createdCount, 9); // 102 through 110 = 9 rooms
  });

  it("should allow authenticated users to list hostels, floors, and rooms (200)", async () => {
    // List Hostels
    const resHostels = await makeRequest("GET", "/api/v1/hostels", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resHostels.status, 200);
    assert.ok(Array.isArray(resHostels.body.data.hostels));

    // List Floors
    const resFloors = await makeRequest("GET", `/api/v1/hostels/${createdHostelId}/floors`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resFloors.status, 200);
    assert.ok(resFloors.body.data.floors.length >= 1);

    // List Rooms
    const resRooms = await makeRequest("GET", `/api/v1/hostels/${createdHostelId}/rooms`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resRooms.status, 200);
    assert.ok(resRooms.body.data.rooms.length >= 10);
  });
});

describe("Phase 3: Laundry Groups Management", () => {
  const adminToken = createToken({ id: 1, role: "admin", email: "admin@vwash.com" });
  const studentToken = createToken({ id: 2, role: "student", email: "student@vwash.com" });

  const dynamicOrder = 2000 + Math.floor(Math.random() * 7000);
  const startRoom = `${dynamicOrder}0`;
  const midRoom = `${dynamicOrder}5`;
  const endRoom = `${dynamicOrder}9`;
  let testGroupId = null;

  it("should forbid non-admin from creating laundry groups (403)", async () => {
    const res = await makeRequest("POST", "/api/v1/laundry-groups", {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        hostelId: 1,
        name: "Hacker Group",
        groupOrder: 9999,
        roomRangeStart: "9000",
        roomRangeEnd: "9010",
      },
    });

    assert.equal(res.status, 403);
  });

  it("should allow Admin to create a laundry group (201)", async () => {
    const res = await makeRequest("POST", "/api/v1/laundry-groups", {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        hostelId: 1,
        name: `Group Test ${dynamicOrder}`,
        groupOrder: dynamicOrder,
        roomRangeStart: startRoom,
        roomRangeEnd: endRoom,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.group.name, `Group Test ${dynamicOrder}`);
    assert.equal(res.body.data.group.groupOrder, dynamicOrder);

    testGroupId = res.body.data.group.id;
  });

  it("should reject creating laundry group with conflicting groupOrder (409)", async () => {
    const res = await makeRequest("POST", "/api/v1/laundry-groups", {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        hostelId: 1,
        name: "Conflicting Group",
        groupOrder: dynamicOrder, // Conflicting order!
        roomRangeStart: "9900",
        roomRangeEnd: "9910",
      },
    });

    assert.equal(res.status, 409);
  });

  it("should allow authenticated users to view groups and preview room resolution (200)", async () => {
    const resList = await makeRequest("GET", "/api/v1/laundry-groups?hostelId=1", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resList.status, 200);
    assert.ok(Array.isArray(resList.body.data.groups));

    // Resolve room endpoint
    const resResolve = await makeRequest(
      "GET",
      `/api/v1/laundry-groups/resolve?hostelId=1&roomNumber=${midRoom}`,
      {
        headers: { Authorization: `Bearer ${studentToken}` },
      }
    );
    assert.equal(resResolve.status, 200);
    assert.equal(resResolve.body.data.group.name, `Group Test ${dynamicOrder}`);
  });

  it("should allow Admin to update a laundry group (200)", async () => {
    assert.ok(testGroupId);

    const res = await makeRequest("PATCH", `/api/v1/laundry-groups/${testGroupId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: `Updated Group ${dynamicOrder}`,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.group.name, `Updated Group ${dynamicOrder}`);
  });
});
