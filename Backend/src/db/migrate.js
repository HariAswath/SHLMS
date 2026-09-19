import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db.js";

async function runMigrations() {
  console.log("[Migration] Running migrations on Supabase database...");
  try {
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    console.log("[Migration] ✓ Migrations applied successfully!");
    process.exit(0);
  } catch (error) {
    console.error("[Migration] Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
