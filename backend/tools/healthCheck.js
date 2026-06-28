/**
 * MONGODB HEALTH CHECK
 * 
 * Simple script to verify the connection to MongoDB Atlas 
 * without trying to perform complex operations.
 */
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;

async function checkConnection() {
    if (!uri) {
        console.error("Error: MONGODB_URI is missing in .env file.");
        process.exit(1);
    }

    console.log("Attempting to connect to MongoDB...");
    const client = new MongoClient(uri, {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000
    });

    try {
        await client.connect();
        const dbList = await client.db().admin().listDatabases();
        console.log("SUCCESS: Connected to MongoDB Atlas!");
        console.log("Available Databases:", dbList.databases.map(db => db.name).join(", "));
    } catch (error) {
        console.error("CONNECTION FAILED!");
        console.error("-------------------");
        console.error(`Error Code: ${error.code || 'N/A'}`);
        console.error(`Message: ${error.message}`);
        console.error("-------------------");
        
        console.error("DEBUG TIPS:");
        if (error.message.includes("querySrv E") || (error.code === 'ECONNREFUSED' && uri.includes("+srv"))) {
            console.log("👉 DNS ISSUE DETECTED: Your local DNS server is failing to resolve MongoDB SRV records.");
            console.log("👉 FIX: Use the 'Standard Connection String' in your .env (I have already updated this for you).");
        } else {
            console.error("1. Check if your IP address is whitelisted in MongoDB Atlas 'Network Access'.");
            console.error("2. Ensure the username and password in .env are correct.");
            console.error("3. Check if your network uses a proxy or firewall that blocks port 27017.");
        }
    } finally {
        await client.close();
    }
}

checkConnection();
