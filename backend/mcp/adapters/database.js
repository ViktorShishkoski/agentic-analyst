import readline from "readline";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

async function handleRequest(request) {
    const { id, method, params } = request;
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
    const dbName = process.env.DB_NAME || "agentic_db";

    if (method === "tools/list") {
        return {
            tools: [
                {
                    name: "list_collections",
                    description: "List all collections in the database",
                    inputSchema: { type: "object", properties: {} }
                },
                {
                    name: "query_collection",
                    description: "Queries documents from a collection",
                    inputSchema: {
                        type: "object",
                        properties: {
                            collection: { type: "string" },
                            filter: { type: "object" },
                            limit: { type: "number" }
                        },
                        required: ["collection"]
                    }
                }
            ]
        };
    }

    if (method === "tools/call") {
        const { name, arguments: args } = params;
        const client = new MongoClient(uri);

        try {
            await client.connect();
            const db = client.db(dbName);

            if (name === "list_collections") {
                const cols = await db.listCollections().toArray();
                return {
                    content: [{ type: "text", text: JSON.stringify(cols.map(c => c.name)) }]
                };
            }

            if (name === "query_collection") {
                const col = db.collection(args.collection);
                const filter = args.filter || {};
                const limit = args.limit || 50;
                
                const docs = await col.find(filter).limit(limit).toArray();
                return {
                    content: [{ type: "text", text: JSON.stringify(docs) }]
                };
            }

            throw new Error(`Tool not found: ${name}`);
        } catch (err) {
            return {
                isError: true,
                content: [{ type: "text", text: err.message }]
            };
        } finally {
            await client.close();
        }
    }

    throw new Error(`Method not supported: ${method}`);
}

rl.on("line", async (line) => {
    try {
        const request = JSON.parse(line);
        const result = await handleRequest(request);
        const response = {
            jsonrpc: "2.0",
            id: request.id,
            result
        };
        process.stdout.write(JSON.stringify(response) + "\n");
    } catch (e) {
        const response = {
            jsonrpc: "2.0",
            error: { code: -32603, message: e.message }
        };
        process.stdout.write(JSON.stringify(response) + "\n");
    }
});
