import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const candidateEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
dotenv.config();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.js",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
