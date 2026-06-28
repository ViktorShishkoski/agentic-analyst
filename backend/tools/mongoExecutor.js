import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 🛠️ MONGO EXECUTOR
 * 
 * The actual function that talks to Atlas.
 * This takes a command string (e.g. "collection('restaurants').find({}).toArray()")
 * and executes it directly against the database using eval().
 * 
 * WARNING: eval() is powerful but dangerous. Use with caution.
 */
export async function execute_mongo(commandString) {
    const uri = process.env.MONGODB_URI || "mongodb+srv://ac-uiw0nh1.kvz92hn.mongodb.net/agentic_db";
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db("agentic_db");
        
        // This takes the "string" from the AI and turns it into a real command
        // WARNING: In a real CSE project, you'd parse this safely!
        // We use eval to allow full flexibility of the MongoDB Node driver.
        const result = await eval(`db.${commandString}`); 
        return JSON.stringify(result);
        
    } catch (error) {
        return `Error executing command: ${error.message}`;
    } finally {
        await client.close();
    }
}
