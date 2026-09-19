import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token is missing",
    });
  }

  jwt.verify(token, env.JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired access token",
      });
    }
    // Normalize decoded token payload
    req.user = {
      id: decodedUser.id || decodedUser.sub,
      role: decodedUser.role,
      email: decodedUser.email,
      name: decodedUser.name,
      ...decodedUser,
    };
    next();
  });
};

export const requireRole = (...allowedRoles) => {
  // Support both requireRole("admin", "staff") and requireRole(["admin", "staff"])
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have the required permissions",
      });
    }

    next();
  };
};

export default { authenticateToken, requireRole };
