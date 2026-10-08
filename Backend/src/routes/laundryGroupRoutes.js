import express from "express";
import {
  createLaundryGroup,
  getLaundryGroups,
  getLaundryGroupById,
  updateLaundryGroup,
  deleteLaundryGroup,
  deleteAllLaundryGroups,
  resolveGroup,
} from "../controllers/laundryGroupController.js";
import { authenticateToken, requireRole } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import {
  createLaundryGroupSchema,
  updateLaundryGroupSchema,
} from "../utils/validators/hostelValidators.js";

const router = express.Router();

router.use(authenticateToken);

// Group Resolution Preview / Verification
router.get("/resolve", resolveGroup);

// Laundry Group Endpoints
router.post(
  "/",
  requireRole("admin"),
  validate(createLaundryGroupSchema),
  createLaundryGroup
);
router.get("/", getLaundryGroups);
router.delete("/all", requireRole("admin"), deleteAllLaundryGroups);
router.get("/:id", getLaundryGroupById);
router.patch(
  "/:id",
  requireRole("admin"),
  validate(updateLaundryGroupSchema),
  updateLaundryGroup
);
router.delete("/:id", requireRole("admin"), deleteLaundryGroup);

export default router;
