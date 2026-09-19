import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import { errorMiddleware } from "./middleware/errorMiddleware.js";

const app = express();

// Middlewares
app.use(
  cors({
    origin: true, // Allow all in dev, can restrict in production
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check endpoint
app.get("/api/v1/healthcheck", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    },
  });
});

// API Routes
app.use("/api/v1/auth", authRoutes);

// Catch 404 for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Global Error Handler
app.use(errorMiddleware);

export default app;
