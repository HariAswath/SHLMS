import express from "express";
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  updateUserStatus,
} from "../controllers/userController.js";
import { authenticateToken, requireRole } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  getUsersQuerySchema,
} from "../utils/validators/userValidators.js";

const router = express.Router();

// All user management routes require authentication
router.use(authenticateToken);

// 1. Create Student or Staff (Admin only)
router.post(
  "/",
  requireRole("admin"),
  validate(createUserSchema),
  createUser
);

// 2. List Users with Filters and Pagination (Admin only)
router.get(
  "/",
  requireRole("admin"),
  validate(getUsersQuerySchema),
  getUsers
);

// 3. Get User By ID (Admin or Self)
router.get(
  "/:id",
  getUserById
);

// 4. Update User Details (Admin only)
router.patch(
  "/:id",
  requireRole("admin"),
  validate(updateUserSchema),
  updateUser
);

// 5. Activate or Deactivate User (Admin only)
router.patch(
  "/:id/status",
  requireRole("admin"),
  validate(updateUserStatusSchema),
  updateUserStatus
);

export default router;
