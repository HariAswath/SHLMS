import pkg from "pg";
const { Pool } = pkg;
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import * as relations from "./relations.js";
import { env } from "../config/env.js";

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase / Neon connections
  },
});

export const db = drizzle(pool, {
  schema: {
    ...schema,
    ...relations,
  },
});

export default db;
