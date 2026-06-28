/**
 * UNIVERSAL DATA INGESTION TOOL
 *
 * Part of the Agentic Data Analyst Pipeline.
 * Handles CSV and JSON data ingestion into MongoDB Atlas.
 */

import { MongoClient } from "mongodb";
import { parse } from "csv-parse/sync";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || "agentic_db";

/**
 * cleanAndParseJSON
 * Handles common "dirty data" issues like trailing commas or JSON Lines.
 */
function cleanAndParseJSON(rawData) {
  // Remove UTF-8 BOM if present
  const cleanedText = rawData.replace(/^\ufeff/, "");
  const trimmed = cleanedText.trim();

  // Try standard parse
  try {
    const data = JSON.parse(trimmed);
    console.log("📂 Detected: Standard JSON Array/Object");
    return Array.isArray(data) ? data : [data];
  } catch (e) {
    // Attempt 1: Remove trailing commas
    try {
      const cleaned = trimmed.replace(/,\s*([\]}])/g, "$1");
      const data = JSON.parse(cleaned);
      console.log("📂 Detected: JSON with Trailing Commas (Self-Corrected)");
      return Array.isArray(data) ? data : [data];
    } catch (e2) {
      // Attempt 2: JSON Lines (each line is a separate JSON object)
      try {
        const lines = trimmed.split("\n").filter((l) => l.trim());
        const data = lines.map((l) => JSON.parse(l));
        console.log("📂 Detected: JSON Lines Format");
        return data;
      } catch (e3) {
        throw new Error(`JSON Parsing failed: ${e3.message}`);
      }
    }
  }
}

/**
 * flattenObject
 * Flattens nested objects into dot-notation keys (e.g., {a:{b:1}} -> {"a.b":1})
 */
function flattenObject(obj, prefix = "") {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + "." : "";
    if (
      typeof obj[k] === "object" &&
      obj[k] !== null &&
      !Array.isArray(obj[k])
    ) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

/**
 * ingestData
 * @param {string} rawData - The raw string of CSV or JSON data
 * @param {string} format - 'csv' or 'json'
 * @param {string} collectionName - Target collection name
 * @param {boolean} overwrite - Whether to drop the collection first (default true)
 */
export async function ingestData(
  rawData, format, collectionName, overwrite = true
) {
  if (!uri) {
    throw new Error("MONGODB_URI is not defined in .env");
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    let data = [];
    const detectedFormat = format.toLowerCase();

    // Stage 1: Robust Parsing & Format Detection
    // We try JSON first if the format is JSON, or if it looks like JSON,
    // or as a fallback before CSV if we're not sure.
    // Stage 1: Robust Parsing & Format Detection
    const trimmed = rawData.trim();
    const isExplicitJson = detectedFormat === "json";
    const looksLikeJson = trimmed.startsWith("[") || trimmed.startsWith("{");

    if (isExplicitJson || looksLikeJson) {
      console.log(`📂 Processing as JSON (${isExplicitJson ? "Explicit" : "Detected"})...`);
      try {
        data = cleanAndParseJSON(rawData);
      } catch (jsonError) {
        // If it was explicitly JSON, we fail. If it was a guess, we try CSV.
        if (isExplicitJson) {
          throw jsonError;
        }
        console.log("⚠️ Failed to parse as JSON, trying CSV fallback...");
        data = null;
      }
    }

    if (!data || data.length === 0) {
      console.log("📂 Processing as CSV (or JSON fallback)...");
      try {
        data = parse(rawData, {
          columns: true,
          skip_empty_lines: true,
          cast: true,
          relax_column_count: false
        });
      } catch (csvError) {
        if (csvError.message.includes("Invalid Record Length")) {
          throw new Error(`CSV Parse Error: Invalid Record Length. This often occurs when a JSON file (like restaurants.json) is treated as CSV. Ensure the format is correctly specified.`);
        }
        // If we already failed JSON, and now we failed CSV, throw a combined error
        if (looksLikeJson) {
          throw new Error(`Data format unknown. Tried JSON and CSV. CSV Error: ${csvError.message}`);
        }
        throw new Error(`CSV Parse Error: ${csvError.message}`);
      }
    }

    // Stage 2: Data Flattening (For Visualization Consistency)
    console.log("🧠 Thinking Phase: Flattening nested structures...");
    const flattenedData = data.map((doc) => flattenObject(doc));

    // Stage 3: Automated Discovery (R-Bridge)
    let summaryMetadata = null;
    const tempCsv = path.join(process.cwd(), `temp_${Date.now()}.csv`);
    try {
      console.log("🔍 Running Automated Data Discovery...");

      // We use the first 1000 records for summary to avoid huge files
      const csvContent = convertToCSV(flattenedData.slice(0, 1000));
      fs.writeFileSync(tempCsv, csvContent);

      const rResult = execSync(
        `Rscript tools/dataDiscovery.R "${tempCsv}"`
      ).toString();
      summaryMetadata = JSON.parse(rResult);
      console.log("✅ Discovery Complete.");
    } catch (discoveryError) {
      console.error("⚠️ Discovery Warning:", discoveryError.message);
    } finally {
      if (fs.existsSync(tempCsv)) {
        fs.unlinkSync(tempCsv); // Cleanup guaranteed
      }
    }

    // Stage 4: Cleanup / Overwrite
    if (overwrite) {
      console.log(`Dropping existing collection: ${collectionName}`);
      await collection.drop().catch((err) => {
        if (err.codeName !== "NamespaceNotFound") throw err;
      });
    }

    // Stage 5: Insertion
    if (flattenedData.length > 0) {
      const result = await collection.insertMany(flattenedData);
      console.log(
        `Successfully ingested ${result.insertedCount} ` +
        `records into '${collectionName}'.`
      );

      // Clear schema cache so discovery node will re-run profiling
      await db.collection("_schema_cache").deleteOne({ _id: "master_schema" }).catch(() => {});

      return {
        ...result,
        summary: summaryMetadata
      };
    } else {
      return { insertedCount: 0, summary: null };
    }
  } catch (error) {
    console.error("❌ Ingestion failed:", error);
    throw error;
  } finally {
    await client.close();
  }
}

function convertToCSV(objArray) {
  if (!objArray || !objArray.length) return "";
  const array = typeof objArray !== "object" ? JSON.parse(objArray) : objArray;
  let str = "";
  const headers = Object.keys(array[0]).join(",") + "\r\n";
  str += headers;
  for (let i = 0; i < array.length; i++) {
    let line = "";
    for (const index in array[i]) {
      if (line !== "") line += ",";
      let val = array[i][index];
      // Escape commas in values
      if (typeof val === "string" && val.includes(",")) {
        val = `"${val}"`;
      }
      line += val;
    }
    str += line + "\r\n";
  }
  return str;
}

// CLI / Direct execution support
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  const [, , raw, fmt, col] = process.argv;
  if (raw && fmt && col) {
    ingestData(raw, fmt, col)
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}
