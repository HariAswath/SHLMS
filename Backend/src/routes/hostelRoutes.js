import express from "express";
import {
  createHostel,
  getHostels,
  getHostelById,
  createFloor,
  getFloors,
  createRoom,
  createRoomsBulk,
  getRooms,
} from "../controllers/hostelController.js";
import { authenticateToken, requireRole } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import {
  createHostelSchema,
  createFloorSchema,
  createRoomSchema,
  createRoomsBulkSchema,
} from "../utils/validators/hostelValidators.js";

const router = express.Router();

router.use(authenticateToken);

// Hostel Endpoints
router.post("/", requireRole("admin"), validate(createHostelSchema), createHostel);
router.get("/", getHostels);
router.get("/:id", getHostelById);

// Floor Endpoints
router.post("/:id/floors", requireRole("admin"), validate(createFloorSchema), createFloor);
router.get("/:id/floors", getFloors);

// Room Endpoints
router.post("/:id/rooms", requireRole("admin"), validate(createRoomSchema), createRoom);
router.post("/:id/rooms/bulk", requireRole("admin"), validate(createRoomsBulkSchema), createRoomsBulk);
router.get("/:id/rooms", getRooms);

export default router;
