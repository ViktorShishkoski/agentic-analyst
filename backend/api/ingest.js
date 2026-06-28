/**
 * INFRASTRUCTURE RECOVERY: ROBUST INGESTION
 * Refactored to handle "dirty" JSON and CSV with extension awareness.
 */

import { validateAndSanitize, ENTRY_INSTRUCTION } from "../services/entryGuard.js";
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
 * detectSeparator
 * Analyzes the first few lines of raw data to guess the delimiter.
 */
function detectSeparator(rawData) {
    const lines = rawData.split("\n").slice(0, 5).filter(l => l.trim());
    if (lines.length === 0) return ",";

    const candidates = [",", ";", "\t", "|"];
    let bestSep = ",";
    let maxCount = -1;

    candidates.forEach(sep => {
        // Count total occurrences in the sample lines
        const total = lines.reduce((acc, line) => acc + (line.split(sep).length - 1), 0);
        if (total > maxCount) {
            maxCount = total;
            bestSep = sep;
        }
    });

    return bestSep;
}

/**
 * sanitzeAndParseJSON
 * Removes trailing commas and other common "restaurants.json" errors.
 */
function sanitizeAndParseJSON(rawData) {
    // Remove UTF-8 BOM
    let cleaned = rawData.replace(/^\ufeff/, "").trim();
    
    // REGEX: Remove trailing commas before closing braces/brackets
    // Handles: { "a": 1, } -> { "a": 1 } and [ 1, 2, ] -> [ 1, 2 ]
    cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

    try {
        // Attempt Standard Parse
        const data = JSON.parse(cleaned);
        return Array.isArray(data) ? data : [data];
    } catch (e) {
        // Attempt JSON Lines (One object per line)
        try {
            const lines = cleaned.split("\n").filter(l => l.trim());
            return lines.map(l => JSON.parse(l));
        } catch (e2) {
            throw new Error(`JSON Sanitization failed: ${e.message}`);
        }
    }
}

/**
 * flattenObject
 * Ensures nested data is queryable in standard Mongo aggregations.
 */
function flattenObject(obj, prefix = "") {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + "." : "";
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

export async function ingestData(rawData, format, collectionName, overwrite = true) {
    if (!uri) throw new Error("MONGODB_URI missing from environment.");

    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        let data = [];
        
        // 1. EXTENSION & CONTENT AWARE BRANCHING
        const trimmed = rawData.trim();
        const isExplicitJson = format === "json";
        const looksLikeJson = trimmed.startsWith("[") || trimmed.startsWith("{");

        if (isExplicitJson || looksLikeJson) {
            console.log(`📂 Processing as JSON (${isExplicitJson ? "Explicit" : "Detected"})...`);
            try {
                data = sanitizeAndParseJSON(rawData);
            } catch (jsonErr) {
                // If it was explicitly requested as JSON, we shouldn't fall back to CSV
                if (isExplicitJson) throw jsonErr;
                console.warn("⚠️ Content looked like JSON but failed to parse. Trying CSV fallback...");
            }
        }

        if (!data || data.length === 0) {
            const separator = detectSeparator(rawData);
            console.log(`📂 Processing as CSV (Detected Separator: '${separator === "\t" ? "\\t" : separator}')...`);
            try {
                data = parse(rawData, {
                    columns: true,
                    skip_empty_lines: true,
                    cast: true,
                    delimiter: separator,
                    relax_column_count: false // Be strict to catch format errors
                });
            } catch (csvErr) {
                if (csvErr.message.includes("Invalid Record Length")) {
                    throw new Error(`CSV Parsing Failed: Invalid Record Length. This often happens when trying to parse a JSON file (like restaurants.json) as a CSV. Please ensure the data format is correct.`);
                }
                throw new Error(`CSV Parsing Failed: ${csvErr.message}`);
            }
        }

        if (!data || data.length === 0) throw new Error("No data records detected.");

        // 2. DATA FLATTENING
        const processedDocs = data.map(doc => flattenObject(doc));

        // 3. CLEANUP / OVERWRITE
        if (overwrite) {
            await collection.drop().catch(err => {
                if (err.codeName !== "NamespaceNotFound") throw err;
            });
        }

        // 4. EFFICIENT INSERTION
        const result = await collection.insertMany(processedDocs);
        console.log(`✅ Ingested ${result.insertedCount} records into '${collectionName}'`);

        // Clear schema cache so discovery node will re-run profiling
        await db.collection("_schema_cache").deleteOne({ _id: "master_schema" }).catch(err => {
            console.warn("⚠️ Failed to clear schema cache:", err.message);
        });

        return result;
    } finally {
        await client.close();
    }
}

/**
 * ingestUserEntry
 * Specialized ingestion for the Agentic Data Architect pipeline.
 * Uses entryGuard for validation and processor.js logic.
 */
export async function ingestUserEntry(rawData) {
    try {
        // Phase 1: Validation & Sanitization
        const sanitizedData = validateAndSanitize(rawData);

        // Phase 2: Enhanced Mongosh Implementation
        // We can execute this via Node for better control, but following the logic in processor.js
        const client = new MongoClient(uri);
        await client.connect();
        const db = client.db(process.env.MONGO_DB || "analyst_db");
        const collName = "metrics_v1";
        const collection = db.collection(collName);

        const results = [];
        for (const entry of sanitizedData) {
            const res = await collection.updateOne(
                { 
                    category: entry.category, 
                    timestamp: entry.timestamp 
                },
                { 
                    $set: { 
                        category: entry.category,
                        value: entry.value,
                        processed_at: new Date(),
                        source: "agentic_pipeline"
                    }
                },
                { upsert: true }
            );
            results.push(res);
        }

        // Clear schema cache so discovery node will re-run profiling
        await db.collection("_schema_cache").deleteOne({ _id: "master_schema" }).catch(() => {});

        await client.close();
        return { 
            success: true, 
            count: sanitizedData.length, 
            status: "Verified for R",
            summary: `Processed ${sanitizedData.length} entries into ${collName}`
        };
    } catch (error) {
        // If validation fails, provide the guardrail instruction
        if (error.message.includes(ENTRY_INSTRUCTION)) {
            throw new Error(`GUARDRAIL TRIGGERED: ${error.message}`);
        }
        throw error;
    }
}
