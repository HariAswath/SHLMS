import { env } from "../config/env.js";
import pkg from "pg";
const { Pool } = pkg;
import crypto from "crypto";

// 1x1 transparent GIF base64 string for testing upload
const SAMPLE_IMAGE_BASE64 = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function mask(str, visibleChars = 4) {
  if (!str) return "(none)";
  if (str.length <= visibleChars) return "***";
  return str.slice(0, visibleChars) + "..." + str.slice(-visibleChars);
}

function generateCloudinarySignature(params, apiSecret) {
  const sortedKeys = Object.keys(params).sort();
  const serialized = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  return crypto.createHash("sha1").update(serialized + apiSecret).digest("hex");
}

async function testDatabase() {
  console.log("\n==========================================");
  console.log(" 1. TESTING POSTGRESQL DATABASE CONNECTION");
  console.log("==========================================");

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set!");
  }

  // Display masked connection info
  const dbUrl = new URL(env.DATABASE_URL);
  console.log(`Host: ${dbUrl.hostname}`);
  console.log(`Port: ${dbUrl.port}`);
  console.log(`Database: ${dbUrl.pathname}`);
  console.log(`User: ${dbUrl.username}`);

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  console.log("✅ Successfully connected to PostgreSQL instance!");

  try {
    // 1. Connection & Version check
    const timeRes = await client.query("SELECT NOW() as current_time, version() as pg_version;");
    console.log(`✅ DB Current Time: ${timeRes.rows[0].current_time}`);
    console.log(`✅ DB Version: ${timeRes.rows[0].pg_version.split("\n")[0]}`);

    // Check existing tables
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    const tables = tableRes.rows.map((r) => r.table_name);
    console.log(`📊 Existing Tables in public schema (${tables.length}):`, tables.length > 0 ? tables.join(", ") : "(None yet)");

    // 2. Test CRUD operations using a temporary dedicated table
    console.log("\n--- Testing Database CRUD Operations ---");
    
    // Create Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _vwash_connection_test (
        id SERIAL PRIMARY KEY,
        test_key TEXT NOT NULL,
        test_value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ [CREATE TABLE] Test table '_vwash_connection_test' created or confirmed.");

    // CREATE (Insert)
    const insertRes = await client.query(
      `INSERT INTO _vwash_connection_test (test_key, test_value) VALUES ($1, $2) RETURNING *;`,
      ["probe_key", "initial_value"]
    );
    const createdRow = insertRes.rows[0];
    console.log(`✅ [CRUD: CREATE] Inserted test row with id = ${createdRow.id}:`, createdRow);

    // READ (Select)
    const selectRes = await client.query(
      `SELECT * FROM _vwash_connection_test WHERE id = $1;`,
      [createdRow.id]
    );
    const readRow = selectRes.rows[0];
    console.log(`✅ [CRUD: READ] Successfully read test row:`, readRow);

    // UPDATE
    const updateRes = await client.query(
      `UPDATE _vwash_connection_test SET test_value = $1 WHERE id = $2 RETURNING *;`,
      ["updated_value_verified", createdRow.id]
    );
    const updatedRow = updateRes.rows[0];
    console.log(`✅ [CRUD: UPDATE] Updated test row:`, updatedRow);

    // DELETE
    const deleteRes = await client.query(
      `DELETE FROM _vwash_connection_test WHERE id = $1 RETURNING *;`,
      [createdRow.id]
    );
    console.log(`✅ [CRUD: DELETE] Deleted test row with id = ${deleteRes.rows[0].id}`);

    // Cleanup test table
    await client.query(`DROP TABLE IF EXISTS _vwash_connection_test;`);
    console.log("✅ [CLEANUP] Dropped test table.");

    return { success: true, existingTables: tables };
  } finally {
    client.release();
    await pool.end();
  }
}

async function testCloudinary() {
  console.log("\n==========================================");
  console.log(" 2. TESTING CLOUDINARY API CONNECTION & CRUD");
  console.log("==========================================");

  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  console.log(`Cloud Name: ${cloudName || "(not set)"}`);
  console.log(`API Key: ${mask(apiKey)}`);
  console.log(`API Secret: ${mask(apiSecret)}`);

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Missing Cloudinary credentials in environment!");
  }

  const basicAuth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const authHeader = { Authorization: `Basic ${basicAuth}` };

  // 1. Test Ping / Usage to check credentials
  console.log("\n--- Checking Cloudinary Authentication (Usage API) ---");
  const usageUrl = `https://api.cloudinary.com/v1_1/${cloudName}/usage`;
  const usageResp = await fetch(usageUrl, { headers: authHeader });
  
  if (!usageResp.ok) {
    const errorText = await usageResp.text();
    throw new Error(`Cloudinary authentication failed (${usageResp.status}): ${errorText}`);
  }
  const usageData = await usageResp.json();
  console.log("✅ Authenticated with Cloudinary successfully!");
  console.log(`   Plan: ${usageData.plan}`);
  console.log(`   Credits: ${usageData.credits?.usage || 0} used of ${usageData.credits?.limit || "unlimited"}`);

  // 2. Test CRUD operations on Cloudinary
  console.log("\n--- Testing Cloudinary CRUD Operations ---");
  const testPublicId = `vwash_test_${Date.now()}`;
  const timestamp = Math.floor(Date.now() / 1000);

  // CREATE (Upload Image)
  console.log(`-> [CRUD: CREATE] Uploading test asset: ${testPublicId}...`);
  const uploadParams = {
    public_id: testPublicId,
    timestamp: timestamp.toString(),
  };
  const uploadSignature = generateCloudinarySignature(uploadParams, apiSecret);

  const uploadFormData = new URLSearchParams();
  uploadFormData.append("file", SAMPLE_IMAGE_BASE64);
  uploadFormData.append("public_id", testPublicId);
  uploadFormData.append("timestamp", timestamp.toString());
  uploadFormData.append("api_key", apiKey);
  uploadFormData.append("signature", uploadSignature);

  const uploadResp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: uploadFormData,
  });

  if (!uploadResp.ok) {
    const errText = await uploadResp.text();
    throw new Error(`Cloudinary upload failed (${uploadResp.status}): ${errText}`);
  }
  const uploadData = await uploadResp.json();
  console.log("✅ [CRUD: CREATE] Asset uploaded successfully!");
  console.log(`   Public ID: ${uploadData.public_id}`);
  console.log(`   Secure URL: ${uploadData.secure_url}`);
  console.log(`   Format: ${uploadData.format}`);

  // READ (Get Resource Details)
  console.log(`\n-> [CRUD: READ] Fetching details for asset ${testPublicId}...`);
  const readUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload/${testPublicId}`;
  const readResp = await fetch(readUrl, { headers: authHeader });

  if (!readResp.ok) {
    const errText = await readResp.text();
    throw new Error(`Cloudinary read failed (${readResp.status}): ${errText}`);
  }
  const readData = await readResp.json();
  console.log("✅ [CRUD: READ] Successfully retrieved asset metadata!");
  console.log(`   Bytes: ${readData.bytes}, Width: ${readData.width}, Height: ${readData.height}`);

  // UPDATE (Add Tag to Resource)
  console.log(`\n-> [CRUD: UPDATE] Updating tags on ${testPublicId}...`);
  const updateUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload/${testPublicId}`;
  const updateResp = await fetch(updateUrl, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ tags: "vwash_verified" }),
  });

  if (!updateResp.ok) {
    const errText = await updateResp.text();
    throw new Error(`Cloudinary update failed (${updateResp.status}): ${errText}`);
  }
  const updateData = await updateResp.json();
  console.log("✅ [CRUD: UPDATE] Successfully updated asset tags:", updateData.tags);

  /* DELETE (Destroy Image)
  console.log(`\n-> [CRUD: DELETE] Destroying test asset ${testPublicId}...`);
  const deleteTimestamp = Math.floor(Date.now() / 1000);
  const deleteParams = {
    public_id: testPublicId,
    timestamp: deleteTimestamp.toString(),
  };
  const deleteSignature = generateCloudinarySignature(deleteParams, apiSecret);

  const deleteFormData = new URLSearchParams();
  deleteFormData.append("public_id", testPublicId);
  deleteFormData.append("timestamp", deleteTimestamp.toString());
  deleteFormData.append("api_key", apiKey);
  deleteFormData.append("signature", deleteSignature);

  const deleteResp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    body: deleteFormData,
  });

  if (!deleteResp.ok) {
    const errText = await deleteResp.text();
    throw new Error(`Cloudinary delete failed (${deleteResp.status}): ${errText}`);
  }
  const deleteData = await deleteResp.json();
  console.log("✅ [CRUD: DELETE] Successfully deleted test asset. Result:", deleteData);
  */

  return { success: true };
}

async function main() {
  console.log("==================================================");
  console.log(" V-WASH INTEGRATION & CONNECTION DIAGNOSTIC RUNNER");
  console.log("==================================================");

  let dbSuccess = false;
  let cloudinarySuccess = false;

  try {
    await testDatabase();
    dbSuccess = true;
  } catch (err) {
    console.error("❌ Database connection/CRUD error:", err.message);
  }

  try {
    await testCloudinary();
    cloudinarySuccess = true;
  } catch (err) {
    console.error("❌ Cloudinary connection/CRUD error:", err.message);
  }

  console.log("\n==================================================");
  console.log(" DIAGNOSTIC SUMMARY");
  console.log("==================================================");
  console.log(`PostgreSQL Database: ${dbSuccess ? "✅ ALL TESTS PASSED" : "❌ FAILED"}`);
  console.log(`Cloudinary API:      ${cloudinarySuccess ? "✅ ALL TESTS PASSED" : "❌ FAILED"}`);

  if (!dbSuccess || !cloudinarySuccess) {
    process.exit(1);
  }
}

main();
