import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

/**
 * flattenObject
 * Recursively flattens a nested object into dot-notation keys.
 */
export function flattenObject(obj, prefix = "") {
    let results = [];
    for (let key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && value.constructor.name !== "ObjectId") {
            results.push(...flattenObject(value, fullKey));
        } else {
            results.push(fullKey);
        }
    }
    return results;
}

/**
 * Reusable schema profiling function, independent of LangGraph state.
 */
export async function runSchemaProfiling(dbName = "agentic_db", uri = process.env.MONGODB_URI, io = null) {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db(dbName);

        // Persistent cache collection lookup
        const cacheCollection = db.collection("_schema_cache");
        const cachedDoc = await cacheCollection.findOne({ _id: "master_schema" });
        
        // Cache is valid for 15 minutes
        if (cachedDoc && cachedDoc.updatedAt && (Date.now() - new Date(cachedDoc.updatedAt).getTime() < 15 * 60 * 1000)) {
            if (io) {
                io.emit("milestone", { node: "Discovery", msg: "✅ Master Schema Context retrieved from cache." });
            }
            return {
                schema: cachedDoc.schema,
                schemaObject: cachedDoc.schemaObject,
                samples: cachedDoc.samples,
                fromCache: true
            };
        }

        if (io) io.emit("milestone", { node: "Discovery", msg: "📡 Cache expired or invalid. Running full schema profiling..." });

        const collections = (await db.listCollections().toArray())
            .filter(c => !c.name.startsWith("system.") && !c.name.startsWith("_")); // Ignore cache/system collections
        
        let masterContext = "### MASTER SCHEMA CONTEXT\n\n";
        const schemaObject = {};
        const firstLookSamples = {};

        for (const colInfo of collections) {
            const colName = colInfo.name;
            const collection = db.collection(colName);
            
            // 1. Fast estimated document count checking
            const count = await collection.estimatedDocumentCount();
            let samples = [];
            
            if (count > 5000) {
                if (io) io.emit("milestone", { node: "Discovery", msg: `⚡ Large collection detected: '${colName}' (${count} docs). Sampling 1,000 docs.` });
                samples = await collection.aggregate([{ $sample: { size: 1000 } }]).toArray();
            } else {
                samples = await collection.find().limit(1000).toArray();
            }

            if (samples.length === 0) continue;

            // Save the first 5 samples for the frontend viewer
            firstLookSamples[colName] = samples.slice(0, 5);

            const allKeys = new Set();
            samples.forEach(doc => flattenObject(doc).forEach(k => allKeys.add(k)));

            let colSummary = `**Collection:** \`${colName}\`\n**Fields:**\n`;
            schemaObject[colName] = {};

            for (const key of allKeys) {
                // Get type of field from first sample that has it
                const sampleWithKey = samples.find(s => {
                    const parts = key.split('.');
                    let curr = s;
                    for (const p of parts) {
                        if (curr && typeof curr === 'object' && p in curr) curr = curr[p];
                        else return false;
                    }
                    return true;
                });

                if (!sampleWithKey) continue;
                
                // Get value
                const parts = key.split('.');
                let val = sampleWithKey;
                for (const p of parts) val = val[p];

                let type = typeof val;
                if (val instanceof Date) type = "Date";
                else if (Array.isArray(val)) type = "Array";
                else if (val === null) type = "Null";
                else if (type === "object" && val.constructor.name === "ObjectId") type = "ObjectId";

                // Extract values from memory samples rather than running database distinct scans
                const uniqueValues = Array.from(new Set(samples.map(s => {
                    let curr = s;
                    for (const p of parts) {
                        if (curr && typeof curr === 'object' && p in curr) curr = curr[p];
                        else return undefined;
                    }
                    return curr;
                }).filter(v => v !== undefined && v !== null && typeof v !== 'object')));

                schemaObject[colName][key] = {
                    values: uniqueValues.slice(0, 10),
                    isCategorical: uniqueValues.length < 25
                };

                let details = "";
                if (type === "string") {
                    if (uniqueValues.length < 25) {
                        details = ` (Allowed Values: [${uniqueValues.map(v => `'${v}'`).join(", ")}])`;
                    } else {
                        details = ` (High Cardinality String)`;
                    }
                } else if (type === "number") {
                    const numValues = samples.map(s => {
                        let curr = s;
                        for (const p of parts) {
                            if (curr && typeof curr === 'object' && p in curr) curr = curr[p];
                            else return undefined;
                        }
                        return curr;
                    }).filter(v => typeof v === 'number' && !isNaN(v));

                    if (numValues.length > 0) {
                        const min = Math.min(...numValues);
                        const max = Math.max(...numValues);
                        details = ` (Scale: Min ${min}, Max ${max})`;
                    }
                }

                colSummary += `- \`${key}\` (${type})${details}\n`;
            }

            masterContext += colSummary + "\n";
        }

        // Cache the newly generated master schema context
        await cacheCollection.updateOne(
            { _id: "master_schema" },
            {
                $set: {
                    schema: masterContext,
                    schemaObject: schemaObject,
                    samples: firstLookSamples,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        return {
            schema: masterContext,
            schemaObject,
            samples: firstLookSamples,
            fromCache: false
        };

    } finally {
        await client.close();
    }
}

/**
 * 🔍 DYNAMIC SCHEMA PROFILER (LangGraph Node Wrapper)
 */
export async function discoveryNode(state) {
    const io = state.dataContext.io;
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || "agentic_db";

    if (io) io.emit("milestone", { node: "Discovery", msg: "📡 Initiating Dynamic Schema Profiling..." });

    try {
        const profile = await runSchemaProfiling(dbName, uri, io);

        if (io) {
            io.emit("milestone", { node: "Discovery", msg: profile.fromCache ? "✅ Master Schema Context retrieved from cache." : "✅ Master Schema Context synthesized & cached." });
            for (const [colName, samples] of Object.entries(profile.samples)) {
                io.emit("discovery-sample", { collection: colName, data: samples });
            }
        }

        return {
            dataContext: {
                ...state.dataContext,
                schema: profile.schema,
                schemaObject: profile.schemaObject,
                samples: profile.samples,
                lastStep: "discovery-complete"
            }
        };

    } catch (error) {
        console.error("❌ Profiler Failed:", error);
        return { dataContext: { ...state.dataContext, error: error.message, lastStep: "discovery-failed" } };
    }
}
