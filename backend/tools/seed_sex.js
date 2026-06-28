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

    await collection.deleteMany({});
    
    const sampleData = [
        { region: "North", product: "Laptop", amount: 1200, date: new Date(), SEX: "M" },
        { region: "North", product: "Phone", amount: 800, date: new Date(), SEX: "F" },
        { region: "South", product: "Laptop", amount: 1500, date: new Date(), SEX: "M" },
        { region: "South", product: "Phone", amount: 700, date: new Date(), SEX: "F" },
    ];

    const result = await collection.insertMany(sampleData);
    console.log(`Successfully seeded ${result.insertedCount} records.`);

    // Clear schema cache so discovery node will re-run profiling
    await db.collection("_schema_cache").deleteOne({ _id: "master_schema" }).catch(() => {});

  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    await client.close();
  }
}

seedData();
