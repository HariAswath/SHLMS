import express from "express";
import crypto from "crypto";
import { env } from "../config/env.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

// Generate a signed upload signature for the frontend to upload directly to Cloudinary.
// This keeps the API secret server-side while letting the client upload without a round trip.
router.post("/cloudinary-signature", (req, res) => {
  const { folder = "shlms" } = req.body;
  const timestamp = Math.round(Date.now() / 1000);
  const params = { folder, timestamp };

  // Cloudinary requires params sorted alphabetically, joined by '&', then appended with API secret.
  const toSign = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const signature = crypto
    .createHash("sha1")
    .update(toSign + env.CLOUDINARY_API_SECRET)
    .digest("hex");

  res.json({
    success: true,
    data: {
      signature,
      timestamp,
      folder,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
    },
  });
});

export default router;
