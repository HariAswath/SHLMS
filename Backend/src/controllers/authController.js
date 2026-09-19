import { db } from "../db/db.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId || null,
      barcodeValue: user.barcodeValue || null,
    },
    env.JWT_SECRET,
    { expiresIn: "1h" }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id, sub: user.id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
};

const formatSafeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  studentId: user.studentId,
  employeeId: user.employeeId,
  phone: user.phone,
  hostelId: user.hostelId,
  floorId: user.floorId,
  roomId: user.roomId,
  barcodeValue: user.barcodeValue,
  status: user.status,
  createdAt: user.createdAt,
});

export const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (foundUsers.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = foundUsers[0];

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account is deactivated",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set refresh token in httpOnly secure cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        user: formatSafeUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

export const refresh = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: "Refresh token is missing",
    });
  }

  try {
    jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: "Invalid or expired refresh token",
        });
      }

      const userId = decoded.id || decoded.sub;
      const foundUsers = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (foundUsers.length === 0 || foundUsers[0].status !== "active") {
        return res.status(403).json({
          success: false,
          message: "User not found or inactive",
        });
      }

      const user = foundUsers[0];
      const newAccessToken = generateAccessToken(user);

      return res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          accessToken: newAccessToken,
        },
      });
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (foundUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = foundUsers[0];
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
