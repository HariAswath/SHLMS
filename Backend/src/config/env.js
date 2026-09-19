import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "supersecretaccesskey",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "supersecretrefreshkey",
  COOKIE_SECRET: process.env.COOKIE_SECRET || "supersecretcookiekey",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
};

if (!env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not set in environment variables!");
}
