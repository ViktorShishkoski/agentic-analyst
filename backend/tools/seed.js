/**
 * SEEDING SCRIPT
 * 
 * This script populates the 'sales_data' collection with sample records 
 * for our analysis.
 */
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || "agentic_db";

async function seedData() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB for seeding...");
    const db = client.db(dbName);
    const collection = db.collection("sales_data");

    // Clear existing data (optional, but good for fresh starts)
    await collection.deleteMany({});
    console.log("Cleared existing 'sales_data' records.");

    const regions = ["Ohrid", "Skopje", "Bitola"];
    const products = ["Laptop", "Monitor", "Keyboard", "Mouse", "Printer"];
    
    const sampleData = [];

    for (let i = 0; i < 15; i++) {
        const region = regions[Math.floor(Math.random() * regions.length)];
        const product = products[Math.floor(Math.random() * products.length)];
        const amount = Math.floor(Math.random() * 1000) + 100; // $100 - $1100
        const date = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);

        sampleData.push({
            region,
            product,
            amount,
            date,
            status: "Completed"
        });
    }

    const result = await collection.insertMany(sampleData);
    console.log(`Successfully seeded ${result.insertedCount} records into 'sales_data'.`);

    // Clear schema cache so discovery node will re-run profiling
    await db.collection("_schema_cache").deleteOne({ _id: "master_schema" }).catch(() => {});

  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    await client.close();
  }
}

seedData();
