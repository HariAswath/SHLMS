import express from "express";
import {
  createLostFoundItem,
  getLostFoundItems,
  getLostFoundItemById,
  claimLostFoundItem,
  reviewClaim,
} from "../controllers/lostFoundController.js";
import { authenticateToken, requireRole } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import {
  createLostFoundSchema,
  createClaimSchema,
  reviewClaimSchema,
} from "../utils/validators/lostFoundValidators.js";

const router = express.Router();

router.use(authenticateToken);

// 1. Upload Item (Staff & Admin)
router.post(
  "/",
  requireRole("staff", "admin"),
  validate(createLostFoundSchema),
  createLostFoundItem
);

// 2. Browse Items (All Authenticated)
router.get("/", getLostFoundItems);

// 3. Review Claim (Admin Only - above /:id)
router.patch(
  "/claims/:claimId",
  requireRole("admin"),
  validate(reviewClaimSchema),
  reviewClaim
);

// 4. View Single Item by ID
router.get("/:id", getLostFoundItemById);

// 5. Submit Claim (Student or Admin)
router.post(
  "/:id/claim",
  requireRole("student", "admin"),
  validate(createClaimSchema),
  claimLostFoundItem
);

export default router;
