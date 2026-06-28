import { MongoClient } from "mongodb";
import { getAIModel } from "../lib/aiService.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * 📊 ANALYST NODE
 * 
 * CORE PRINCIPLE: Database-First Heavy Lifting.
 * Translates NL to MongoDB Aggregation Pipelines.
 */
export async function analystNode(state) {
    const io = state.dataContext.io;
    if (io) io.emit("milestone", { node: "Analyst", msg: "🧠 Synthesizing MongoDB Aggregation Strategy..." });

    const model = await getAIModel();

    const query = state.dataContext.conceptualQuery || "Provide a summary of the data";
    const schema = state.dataContext.schema || "";

    const systemPrompt = `
    ROLE: Senior MongoDB Data Engineer.
    TASK: Convert Natural Language to a MongoDB Aggregation Pipeline.
    
    CORE PRINCIPLES:
    1. Database-First: Perform all math ($sum, $avg, $count), filtering ($match), and sorting ($sort) inside MongoDB.
    2. Zero Hallucination: Use only the field names provided in the schema.
    3. Type Safety: 
       - ObjectId -> Factor
       - Date -> POSIXct (Ensure dates are handled correctly)
       - Double/Int -> Numeric
    
    SCHEMA MINI-MAP:
    ${schema}
    
    OUTPUT REQUIREMENT:
    You must output a JSON object containing:
    1. "step": 1
    2. "action": "mongo_query_generation"
    3. "collection": The name of the collection to query.
    4. "pipeline": The array of aggregation stages.
    5. "explanation": A brief description of what the query does.
    6. "validation_rules": Rules to ensure $match and $group are valid.
    
    Example:
    {
      "step": 1,
      "action": "mongo_query_generation",
      "collection": "sales",
      "pipeline": [{ "$match": { "status": "A" } }, { "$group": { "_id": "$region", "total": { "$sum": "$amount" } } }],
      "explanation": "Filtering active sales and grouping by region to sum amounts.",
      "validation_rules": "Ensure 'status' and 'amount' fields exist."
    }
    `;

    try {
        const result = await model.generateContent(systemPrompt + "\nUser Query: " + query);
        const plan = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
        
        console.log("🤖 Thinking Plan:", plan.explanation);
        if (io) io.emit("milestone", { node: "Analyst", msg: `📡 Executing Heavy Lifting: ${plan.explanation}` });

        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.DB_NAME || "agentic_db");
        const collection = db.collection(plan.collection);

        const data = await collection.aggregate(plan.pipeline).toArray();
        await client.close();

        if (io) io.emit("milestone", { node: "Analyst", msg: `✅ Data retrieved: ${data.length} records synthesized.` });

        return {
            dataContext: {
                ...state.dataContext,
                mongoOutput: data,
                queryPlan: plan,
                lastStep: "analysis-success"
            }
        };

    } catch (error) {
        console.error("❌ Analysis Failed:", error);
        if (io) io.emit("milestone", { node: "Analyst", msg: `❌ Analysis Error: ${error.message}`, error: true });
        return {
            dataContext: {
                ...state.dataContext,
                mongoError: error.message,
                lastStep: "analysis-failed"
            }
        };
    }
}
