import express from "express";
import { login, logout, refresh, me } from "../controllers/authController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import { loginSchema } from "../utils/validators/authValidators.js";

const router = express.Router();

router.post("/login", validate(loginSchema), login);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.get("/me", authenticateToken, me);

export default router;
