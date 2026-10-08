import { db } from "../db/db.js";
import { laundryGroups } from "../db/schema.js";

async function posttest() {
  await db.delete(laundryGroups);
  console.log("✓ Posttest: All temporary test groups cleared from database.");
  process.exit(0);
}

posttest().catch((err) => {
  console.error("Posttest error:", err);
  process.exit(1);
});
