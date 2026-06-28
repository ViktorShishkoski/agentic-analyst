/**
 * COMPUTER SCIENCE LESSON: Schema Discovery in NoSQL
 * 
 * In traditional Relational Databases (SQL), schemas are rigid and defined upfront.
 * In MongoDB (NoSQL), documents are "schemaless," meaning every document in a 
 * collection could technically have different fields.
 * 
 * THE PROBLEM: Our AI Agent needs to write queries. If it doesn't know 
 * that the field is named 'user_email' instead of just 'email', it will fail.
 * 
 * THE SOLUTION: Automated Discovery.
 * This tool acts as an "X-Ray scanner" for the database. By sampling real data, 
 * we can reconstruct a map for the AI to follow.
 */

import { MongoClient } from "mongodb";
import dotenv from "dotenv";

// Initialize environment variables from .env
dotenv.config();

/**
 * getSchema
 * 
 * Connects to MongoDB, iterates through all collections, and samples 
 * documents to infer the structure.
 */
export async function getSchema() {
  /**
   * WHY: We use an environment variable for the URI to keep our 
   * credentials secret (Security Best Practice!).
   */
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return "Error: Please check if MONGODB_URI is set in your .env file.";
  }

  const client = new MongoClient(uri);

  try {
    // Step 1: Establish Connection
    await client.connect();
    const db = client.db(process.env.DB_NAME);

    // Step 2: List all Collections
    // Equivalent to looking at the "Table of Contents" in a book.
    const collections = await db.listCollections().toArray();
    
    let schemaDescription = "### MongoDB Schema Discovery Results\n\n";

    for (const collectionInfo of collections) {
      const colName = collectionInfo.name;
      
      /**
       * Step 3: Statistical Sampling (ENHANCED)
       * We now sample 100 documents to get a statistically significant look
       * at the data types and avoid "Null vs Type" confusion.
       */
      const samples = await db.collection(colName)
        .aggregate([{ $sample: { size: 100 } }])
        .toArray();
      
      // Extract unique keys and infer types
      const fieldInfo = {};
      samples.forEach(doc => {
        Object.entries(doc).forEach(([key, value]) => {
          if (!fieldInfo[key]) {
            fieldInfo[key] = new Set();
          }
          fieldInfo[key].add(typeof value);
        });
      });

      schemaDescription += `**Collection:** \`${colName}\`\n`;
      const fieldsList = Object.entries(fieldInfo).map(([field, types]) => {
          return `${field} (${Array.from(types).join("/")})`;
      }).join(", ");
      
      schemaDescription += `**Fields & Types:** ${fieldsList}\n\n`;
    }

    return schemaDescription;

  } catch (error) {
    console.error("Discovery Error:", error);
    return `Failed to discover schema: ${error.message}`;
  } finally {
    // Step 4: Close the Connection
    // ALWAYS close database connections to prevent memory leaks!
    await client.close();
  }
}

// Simple test block to allow running this file directly: `node tools/schema.js`
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  console.log("Starting Schema Discovery Test...");
  getSchema().then(console.log);
}
