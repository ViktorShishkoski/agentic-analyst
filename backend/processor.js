/**
 * 🛠️ ENHANCED MONGOSH PROCESSOR
 * Handles type conversion and upserts to prevent the "Cycle of Failure".
 * Designed to be run via mongosh.
 */

const dbName = process.env.MONGO_DB || "analyst_db";
const collName = "metrics_v1";
const targetDb = db.getSiblingDB(dbName);

function ingest(data) {
    if (!Array.isArray(data)) {
        data = [data];
    }

    const results = data.map(entry => {
        // Strict Type Casting for Python/Pandas Compatibility
        const cleanValue = parseFloat(entry.value);
        if (isNaN(cleanValue)) {
            print(`❌ Error: Invalid numeric value: ${entry.value}`);
            return null;
        }

        return targetDb[collName].updateOne(
            { 
                category: entry.category.trim(), 
                timestamp: entry.timestamp || new Date().toISOString() 
            },
            { 
                $set: { 
                    category: entry.category.trim(),
                    value: cleanValue,
                    processed_at: new Date(),
                    source: "agentic_pipeline"
                }
            },
            { upsert: true }
        );
    });

    const successful = results.filter(r => r !== null);
    print(`✅ Ingestion Complete. Processed: ${successful.length} entries.`);
    return { count: successful.length, status: "Verified for R" };
}

// If data is passed via --eval or global variable 'inputData'
if (typeof inputData !== 'undefined') {
    ingest(inputData);
}
