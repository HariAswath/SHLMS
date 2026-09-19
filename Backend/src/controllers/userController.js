import { db } from "../db/db.js";
import { users, hostels, floors, rooms } from "../db/schema.js";
import { eq, and, or, ilike, sql, count } from "drizzle-orm";
import { hashPassword } from "../utils/password.js";
import { generateStudentBarcode } from "../utils/barcode.js";
import { AppError } from "../utils/AppError.js";

const formatSafeUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
};

// ==========================================
// 1. Create User (Student or Staff) - Admin Only
// ==========================================
export const createUser = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role,
      studentId,
      employeeId,
      phone,
      hostelId,
      floorId,
      roomId,
      barcodeValue,
      status,
    } = req.body;

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if email is already registered
    const existingEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingEmail.length > 0) {
      throw new AppError("A user with this email address already exists", 409);
    }

    let resolvedBarcode = barcodeValue ? barcodeValue.trim() : null;

    // 2. Validate Student Specifics
    if (role === "student") {
      const trimmedStudentId = studentId.trim();

      // Check unique studentId
      const existingStudent = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.studentId, trimmedStudentId))
        .limit(1);

      if (existingStudent.length > 0) {
        throw new AppError(`Student ID '${trimmedStudentId}' is already registered`, 409);
      }

      // Default or custom barcode
      if (!resolvedBarcode) {
        resolvedBarcode = generateStudentBarcode(trimmedStudentId);
      }

      // Check unique barcodeValue
      const existingBarcode = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.barcodeValue, resolvedBarcode))
        .limit(1);

      if (existingBarcode.length > 0) {
        throw new AppError(`Barcode '${resolvedBarcode}' is already assigned to another student`, 409);
      }

      // Validate hostel reference if provided
      if (hostelId) {
        const foundHostel = await db
          .select({ id: hostels.id })
          .from(hostels)
          .where(eq(hostels.id, hostelId))
          .limit(1);
        if (foundHostel.length === 0) {
          throw new AppError("Referenced hostel does not exist", 404);
        }
      }

      // Validate floor reference if provided
      if (floorId) {
        const foundFloor = await db
          .select({ id: floors.id, hostelId: floors.hostelId })
          .from(floors)
          .where(eq(floors.id, floorId))
          .limit(1);
        if (foundFloor.length === 0) {
          throw new AppError("Referenced floor does not exist", 404);
        }
        if (hostelId && foundFloor[0].hostelId !== hostelId) {
          throw new AppError("Floor does not belong to the selected hostel", 400);
        }
      }

      // Validate room reference if provided
      if (roomId) {
        const foundRoom = await db
          .select({ id: rooms.id, floorId: rooms.floorId })
          .from(rooms)
          .where(eq(rooms.id, roomId))
          .limit(1);
        if (foundRoom.length === 0) {
          throw new AppError("Referenced room does not exist", 404);
        }
        if (floorId && foundRoom[0].floorId !== floorId) {
          throw new AppError("Room does not belong to the selected floor", 400);
        }
      }
    }

    // 3. Validate Staff Specifics
    if (role === "staff") {
      const trimmedEmployeeId = employeeId.trim();

      const existingStaff = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.employeeId, trimmedEmployeeId))
        .limit(1);

      if (existingStaff.length > 0) {
        throw new AppError(`Employee ID '${trimmedEmployeeId}' is already registered`, 409);
      }
    }

    // 4. Hash password
    const passwordHash = await hashPassword(password);

    // 5. Insert user record
    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role,
        studentId: role === "student" ? studentId.trim() : null,
        employeeId: role === "staff" ? employeeId.trim() : null,
        phone: phone ? phone.trim() : null,
        hostelId: role === "student" ? hostelId || null : null,
        floorId: role === "student" ? floorId || null : null,
        roomId: role === "student" ? roomId || null : null,
        barcodeValue: role === "student" ? resolvedBarcode : null,
        status: status || "active",
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
      data: {
        user: formatSafeUser(newUser),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. Get Users List (Admin Only with Filters & Pagination)
// ==========================================
export const getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const { role, status, search } = req.query;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (role) {
      conditions.push(eq(users.role, role));
    }
    if (status) {
      conditions.push(eq(users.status, status));
    }
    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(users.name, term),
          ilike(users.email, term),
          ilike(users.studentId, term),
          ilike(users.employeeId, term),
          ilike(users.barcodeValue, term)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch total count
    const [totalRes] = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);

    const total = Number(totalRes.count);
    const totalPages = Math.ceil(total / limit) || 1;

    // Fetch paginated records with relations
    const userRecords = await db.query.users.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: (users, { desc }) => [desc(users.createdAt)],
      with: {
        hostel: {
          columns: { id: true, name: true, code: true },
        },
        floor: {
          columns: { id: true, floorNumber: true, name: true },
        },
        room: {
          columns: { id: true, roomNumber: true },
        },
      },
    });

    const safeUsers = userRecords.map(formatSafeUser);

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: {
        users: safeUsers,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. Get User By ID (Admin or Self)
// ==========================================
export const getUserById = async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      throw new AppError("Invalid user ID parameter", 400);
    }

    // Role check: Admin can access any user; students and staff can only access their own profile
    if (req.user.role !== "admin" && req.user.id !== targetId) {
      throw new AppError("Forbidden: You are not authorized to view another user's profile", 403);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, targetId),
      with: {
        hostel: {
          columns: { id: true, name: true, code: true },
        },
        floor: {
          columns: { id: true, floorNumber: true, name: true },
        },
        room: {
          columns: { id: true, roomNumber: true },
        },
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return res.status(200).json({
      success: true,
      message: "User profile retrieved successfully",
      data: {
        user: formatSafeUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. Update User Details (Admin Only)
// ==========================================
export const updateUser = async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      throw new AppError("Invalid user ID parameter", 400);
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, targetId),
    });

    if (!existingUser) {
      throw new AppError("User not found", 404);
    }

    const {
      name,
      email,
      password,
      studentId,
      employeeId,
      phone,
      hostelId,
      floorId,
      roomId,
      barcodeValue,
    } = req.body;

    const updateData = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;

    // Check unique email if changed
    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== existingUser.email) {
        const duplicateEmail = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .limit(1);

        if (duplicateEmail.length > 0) {
          throw new AppError("This email address is already in use by another user", 409);
        }
        updateData.email = normalizedEmail;
      }
    }

    // Update password if provided
    if (password) {
      updateData.passwordHash = await hashPassword(password);
    }

    // Role-specific field updates
    if (existingUser.role === "student") {
      if (studentId !== undefined) {
        const trimmed = studentId.trim();
        if (trimmed !== existingUser.studentId) {
          const duplicateStudentId = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.studentId, trimmed))
            .limit(1);
          if (duplicateStudentId.length > 0) {
            throw new AppError("This student ID is already assigned to another user", 409);
          }
          updateData.studentId = trimmed;
        }
      }

      if (barcodeValue !== undefined) {
        const trimmed = barcodeValue.trim();
        if (trimmed !== existingUser.barcodeValue) {
          const duplicateBarcode = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.barcodeValue, trimmed))
            .limit(1);
          if (duplicateBarcode.length > 0) {
            throw new AppError("This barcode value is already assigned to another student", 409);
          }
          updateData.barcodeValue = trimmed;
        }
      }

      if (hostelId !== undefined) updateData.hostelId = hostelId;
      if (floorId !== undefined) updateData.floorId = floorId;
      if (roomId !== undefined) updateData.roomId = roomId;
    } else if (existingUser.role === "staff") {
      if (employeeId !== undefined) {
        const trimmed = employeeId.trim();
        if (trimmed !== existingUser.employeeId) {
          const duplicateEmployeeId = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.employeeId, trimmed))
            .limit(1);
          if (duplicateEmployeeId.length > 0) {
            throw new AppError("This employee ID is already assigned to another user", 409);
          }
          updateData.employeeId = trimmed;
        }
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, targetId))
      .returning();

    return res.status(200).json({
      success: true,
      message: "User details updated successfully",
      data: {
        user: formatSafeUser(updatedUser),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. Update User Status (Activate/Deactivate) - Admin Only
// ==========================================
export const updateUserStatus = async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      throw new AppError("Invalid user ID parameter", 400);
    }

    const { status } = req.body;

    // Safety guard: Admin cannot deactivate their own account
    if (req.user.id === targetId && status === "inactive") {
      throw new AppError("Action prohibited: You cannot deactivate your own administrator account", 400);
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, targetId),
    });

    if (!existingUser) {
      throw new AppError("User not found", 404);
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetId))
      .returning();

    return res.status(200).json({
      success: true,
      message: `User account has been ${status === "active" ? "activated" : "deactivated"} successfully`,
      data: {
        user: formatSafeUser(updatedUser),
      },
    });
  } catch (error) {
    next(error);
  }
};
