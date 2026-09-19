import { AppError } from "../utils/AppError.js";
import { z } from "zod";

export const errorMiddleware = (err, req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details && { errors: err.details }),
    });
  }

  // Handle Zod Validation Error directly if caught
  if (err instanceof z.ZodError) {
    return res.status(422).json({
      success: false,
      message: "Validation error",
      errors: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // Handle Postgres / Drizzle DB Unique Constraint Violations (error code 23505)
  if (err.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "Duplicate resource: a record with this unique value already exists",
      detail: err.detail,
    });
  }

  // Handle Postgres / Drizzle Foreign Key Violations (error code 23503)
  if (err.code === "23503") {
    return res.status(400).json({
      success: false,
      message: "Referenced related resource does not exist",
      detail: err.detail,
    });
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token has expired",
    });
  }

  // Fallback for unhandled unexpected errors (500)
  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
