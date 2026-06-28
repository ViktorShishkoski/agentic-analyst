import { MongoClient } from "mongodb";
import { getAIModel } from "../lib/aiService.js";
import fs from "fs";
import path from "path";

/**
 * Levenshtein distance utility for fuzzy string matching
 */
function levenshtein(s1, s2) {
    const m = s1.length, n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
            }
        }
    }
    return dp[m][n];
}

/**
 * Deterministic Fuzzy Field & Collection Resolution
 */
function resolveFieldsFuzzy(query, schemaObject, activeCollection = null) {
    let collection = activeCollection;
    const collections = Object.keys(schemaObject).filter(c => !c.startsWith("_") && c !== "system.indexes");
    
    if (!collection && collections.length > 0) {
        let bestCol = null;
        let minColDist = Infinity;
        for (const col of collections) {
            const index = query.toLowerCase().indexOf(col.toLowerCase());
            if (index !== -1) {
                bestCol = col;
                minColDist = 0;
                break;
            }
            const words = query.split(/\s+/);
            
            // Check if collection name contains a query word, or vice-versa
            let foundSubstringMatch = false;
            for (const word of words) {
                const cleanWord = word.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
                if (cleanWord.length < 3) continue;
                if (col.toLowerCase().includes(cleanWord) || cleanWord.includes(col.toLowerCase())) {
                    bestCol = col;
                    minColDist = 0;
                    foundSubstringMatch = true;
                    break;
                }
            }
            if (foundSubstringMatch) break;

            for (const word of words) {
                const cleanWord = word.replace(/[^a-zA-Z0-9_]/g, "");
                if (cleanWord.length < 3) continue;
                const d = levenshtein(cleanWord.toLowerCase(), col.toLowerCase());
                if (d <= 2 && d < minColDist) {
                    minColDist = d;
                    bestCol = col;
                }
            }
        }
        collection = bestCol || collections[0];
    }
    
    if (!collection || !schemaObject[collection]) {
        return { collection: null, resolvedFields: {}, corrections: {} };
    }
    
    const fields = Object.keys(schemaObject[collection]);
    const resolvedFields = {};
    const corrections = {};
    
    const words = query.split(/\s+/);
    words.forEach(word => {
        const cleanWord = word.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
        if (cleanWord.length < 2) return;
        
        // Exact match
        if (fields.includes(cleanWord)) {
            resolvedFields[cleanWord] = cleanWord;
            return;
        }
        
        // Fuzzy match field names
        let bestField = null;
        let minFieldDist = Infinity;
        for (const field of fields) {
            const d = levenshtein(cleanWord, field.toLowerCase());
            if (d <= 2 && d < minFieldDist) {
                minFieldDist = d;
                bestField = field;
            }
        }
        if (bestField && minFieldDist > 0) {
            resolvedFields[cleanWord] = bestField;
            corrections[cleanWord] = bestField;
        }
    });
    
    return { collection, resolvedFields, corrections };
}

/**
 * Resolves fuzzy/typoed/lowercase categorical values to their exact database casing
 */
function resolveCategoricalValue(val, allowedValues) {
    if (!val || !allowedValues || allowedValues.length === 0) return val;
    const lowerVal = String(val).toLowerCase().trim();
    for (const allowed of allowedValues) {
        const lowerAllowed = String(allowed).toLowerCase();
        if (lowerAllowed === lowerVal || 
            lowerAllowed + "s" === lowerVal || 
            lowerVal + "s" === lowerAllowed ||
            lowerAllowed.includes(lowerVal) ||
            lowerVal.includes(lowerAllowed)) {
            return allowed;
        }
    }
    
    // Fuzzy Levenshtein match
    let bestMatch = val;
    let minDistance = Infinity;
    for (const allowed of allowedValues) {
        const d = levenshtein(lowerVal, String(allowed).toLowerCase());
        if (d <= 2 && d < minDistance) {
            minDistance = d;
            bestMatch = allowed;
        }
    }
    return bestMatch;
}

/**
 * Helper to clean and prepend $ to aggregate operators if missing
 */
const getAggOp = (op) => {
    if (!op) return "$sum";
    const cleanOp = op.trim().toLowerCase();
    const cleanOpName = cleanOp.startsWith("$") ? cleanOp.substring(1) : cleanOp;
    const validOps = ["sum", "avg", "min", "max", "count", "push", "addtoset", "first", "last"];
    if (validOps.includes(cleanOpName)) {
        return "$" + (cleanOpName === "addtoset" ? "addToSet" : cleanOpName);
    }
    return "$sum";
};

/**
 * Helper to clean and prepend $ to metric fields
 */
const getMetric = (field) => {
    if (!field) return 1;
    const cleanField = field.trim();
    const cleanFieldName = cleanField.startsWith("$") ? cleanField.substring(1) : cleanField;
    return "$" + cleanFieldName;
};

/**
 * Helper to clean and prepend $ to group fields
 */
const getFieldRef = (field) => {
    if (!field) return "";
    const cleanField = field.trim();
    const cleanFieldName = cleanField.startsWith("$") ? cleanField.substring(1) : cleanField;
    return "$" + cleanFieldName;
};

/**
 * 6 Core Templates for MongoDB Aggregation
 */
const TEMPLATES = {
    count_by_field: {
        slots: ["group_field"],
        build: (slots) => [
            { "$group": { "_id": getFieldRef(slots.group_field), "result": { "$sum": 1 } } },
            { "$project": { "category": "$_id", "value": "$result", "_id": 0 } }
        ]
    },
    count_by_two_fields_pivot: {
        slots: ["row_field", "col_field"],
        build: (slots) => [
            {
                "$facet": {
                    "row_counts": [
                        { "$group": { "_id": getFieldRef(slots.row_field), "count": { "$sum": 1 } } },
                        { "$project": { "category": { "$toString": "$_id" }, "value": "$count", "facet": "row", "_id": 0 } }
                    ],
                    "col_counts": [
                        { "$group": { "_id": getFieldRef(slots.col_field), "count": { "$sum": 1 } } },
                        { "$project": { "category": { "$toString": "$_id" }, "value": "$count", "facet": "col", "_id": 0 } }
                    ]
                }
            },
            {
                "$project": {
                    "data": { "$concatArrays": ["$row_counts", "$col_counts"] }
                }
            },
            { "$unwind": "$data" },
            { "$replaceRoot": { "newRoot": "$data" } }
        ]
    },
    compare_specific_values: {
        slots: ["field", "value_a", "value_b", "metric_field", "agg_op"],
        build: (slots) => {
            const aggOp = getAggOp(slots.agg_op);
            const metric = slots.metric_field ? getMetric(slots.metric_field) : 1;
            return [
                { "$match": { [slots.field]: { "$in": [slots.value_a, slots.value_b] } } },
                { "$group": { "_id": getFieldRef(slots.field), "result": { [aggOp]: metric } } },
                { "$project": { "category": "$_id", "value": "$result", "_id": 0 } }
            ];
        }
    },
    trend_over_time: {
        slots: ["date_field", "metric_field", "agg_op", "interval"],
        build: (slots) => {
            const format = slots.interval === "monthly" ? "%Y-%m" : "%Y-%m-%d";
            const aggOp = getAggOp(slots.agg_op);
            const metric = slots.metric_field ? getMetric(slots.metric_field) : 1;
            return [
                {
                    "$project": {
                        "dateGroup": {
                            "$dateToString": { "format": format, "date": getFieldRef(slots.date_field) }
                        },
                        "metricValue": metric
                    }
                },
                { "$group": { "_id": "$dateGroup", "result": { [aggOp]: "$metricValue" } } },
                { "$sort": { "_id": 1 } },
                { "$project": { "category": "$_id", "value": "$result", "_id": 0 } }
            ];
        }
    },
    top_n: {
        slots: ["group_field", "metric_field", "agg_op", "sort_order", "limit"],
        build: (slots) => {
            const aggOp = getAggOp(slots.agg_op);
            const metric = slots.metric_field ? getMetric(slots.metric_field) : 1;
            const sortOrder = parseInt(slots.sort_order) || -1;
            const limit = parseInt(slots.limit) || 10;
            return [
                { "$group": { "_id": getFieldRef(slots.group_field), "result": { [aggOp]: metric } } },
                { "$sort": { "result": sortOrder } },
                { "$limit": limit },
                { "$project": { "category": "$_id", "value": "$result", "_id": 0 } }
            ];
        }
    },
    distribution: {
        slots: ["numeric_field"],
        build: (slots) => [
            { "$bucketAuto": { "groupBy": getFieldRef(slots.numeric_field), "buckets": 10 } },
            { "$project": { "category": { "$concat": [ { "$toString": "$_id.min" }, " to ", { "$toString": "$_id.max" } ] }, "value": "$count", "_id": 0 } }
        ]
    }
};

/**
 * 📊 DECOMPOSED ANALYST SERVICE
 * Translates NL queries into MongoDB Aggregation Pipelines using a deterministic 5-stage pipeline.
 */
export async function analystNode(state) {
    const io = state.dataContext.io;
    if (io) io.emit("milestone", { node: "Analyst", msg: "🧠 Synthesizing MongoDB Aggregation Strategy..." });

    const schema = state.dataContext.schema || "";
    const schemaObject = state.dataContext.schemaObject || {};
    const conceptualQuery = state.dataContext.conceptualQuery || "Provide a summary of the data";

    // Early exit for schema discovery queries
    if (conceptualQuery === "Internal: Schema Discovery Only") {
        return {
            dataContext: {
                ...state.dataContext,
                lastStep: "discovery-only"
            }
        };
    }

    try {
        let collection = null;
        let intent = null;
        let slots = {};
        let corrections = {};
        let normalizedEntities = [];
        let validationError = null;
        let pipeline = null;

        // --- GOAL OVERRIDE PATHWAY ---
        if (state.dataContext.goal) {
            const goal = state.dataContext.goal;
            if (io) io.emit("milestone", { node: "Analyst", msg: `🎯 Mandatory Goal context detected. Forcing parameters...` });
            collection = goal.collection;
            
            // Map goal parameters to taxonomy
            if (goal.chart_type === "pivot" || goal.agg === "pivot") {
                intent = "count_by_two_fields_pivot";
                slots = {
                    row_field: goal.x_field,
                    col_field: goal.y_field || goal.x_field
                };
            } else {
                intent = "count_by_field";
                slots = {
                    group_field: goal.x_field,
                    metric_field: goal.y_field !== "value" ? goal.y_field : null,
                    agg_op: goal.agg ? `$${goal.agg}` : "$sum"
                };
            }
        } else {
            // --- STAGE 1: TERM & FIELD RESOLUTION (Auto-Correction & Ambiguity) ---
            if (io) io.emit("milestone", { node: "Analyst", msg: "📡 Stage 1: Resolving terms and database fields..." });

            // Deterministic fuzzy match
            const fuzzyResolution = resolveFieldsFuzzy(conceptualQuery, schemaObject);
            const collections = Object.keys(schemaObject).filter(c => !c.startsWith("_") && c !== "system.indexes");
            
            // Build the list of all collections and their fields for the LLM
            let collectionsSchemaDesc = "";
            for (const colName of collections) {
                const fieldsList = Object.keys(schemaObject[colName] || {});
                collectionsSchemaDesc += `- Collection: "${colName}"\n  Fields: [${fieldsList.map(f => `"${f}"`).join(", ")}]\n`;
            }

            // Call lightweight LLM for synonym mapping, pre-processing and ambiguity check
            const resolutionModel = await getAIModel("analyst_resolution");
            
            const resolutionSystemPrompt = `You are a Collection and Term Resolution Agent. Your job is to analyze the user's query, determine the correct database collection to use, and map query terms to exact database fields.

### AVAILABLE COLLECTIONS & THEIR FIELDS:
${collectionsSchemaDesc}

### RULES FOR COLLECTION RESOLUTION:
1. Select the collection that is most semantically relevant to the query. E.g. queries about restaurants, cuisines, bakery, boroughs should use "restaurants__1_"; queries about students, grades, school, family should use "student_mat__1_".
2. If the user query is vague and could apply to multiple collections (or doesn't match any), default to "${fuzzyResolution.collection || collections[0]}".

### ALIAS & SYNONYM RULES:
1. "rows" -> documents / count
2. "columns" / "fields" -> explicit schema fields
3. Synonyms: map vague concepts like "type", "kind", "category", "class" to the closest semantic field from the Valid Schema Fields list of the selected collection.

### AMBIGUITY CHECK:
If the user's intent is unclear, set isAmbiguous to true and provide choice options.

Return ONLY a JSON response:
{
  "resolvedCollection": "exact_collection_name_from_above",
  "cleanedQuery": "string (the corrected and normalized query)",
  "resolvedFields": {
    "vague_term_or_typo": "valid_schema_field"
  },
  "isAmbiguous": false,
  "ambiguityExplanation": null,
  "clarifyingChoices": []
}`;

            const resResult = await resolutionModel.generateContent(
                `User Query: "${conceptualQuery}"`,
                resolutionSystemPrompt,
                { response_format: { type: "json_object" } }
            );
            
            const resPayload = JSON.parse(resResult.response.text().replace(/```json|```/g, "").trim());

            // Handle Ambiguity (Human-in-the-Loop Clarification UI fallback)
            if (resPayload.isAmbiguous) {
                if (io) io.emit("milestone", { node: "Analyst", msg: `⚠️ Ambiguous query detected. Requesting clarification...`, error: true });
                return {
                    dataContext: {
                        ...state.dataContext,
                        isAmbiguous: true,
                        clarificationQuestion: resPayload.ambiguityExplanation || "Your query matches multiple possible options. Please clarify:",
                        choices: resPayload.clarifyingChoices || [
                            { label: `Group by first field`, query: `${conceptualQuery} grouped by first field` }
                        ],
                        lastStep: "analysis-ambiguous"
                    }
                };
            }

            // Resolve collection
            let resolvedCollection = resPayload.resolvedCollection || fuzzyResolution.collection || collections[0];
            if (!schemaObject[resolvedCollection]) {
                resolvedCollection = fuzzyResolution.collection || collections[0];
            }
            collection = resolvedCollection;
            corrections = fuzzyResolution.corrections;

            // Merge resolutions, prioritizing LLM resolved fields
            const mergedResolvedFields = { ...resPayload.resolvedFields };
            if (collection === fuzzyResolution.collection) {
                Object.assign(mergedResolvedFields, fuzzyResolution.resolvedFields, resPayload.resolvedFields);
            }

            Object.entries(mergedResolvedFields).forEach(([raw, resolved]) => {
                if (raw !== resolved) {
                    corrections[raw] = resolved;
                    normalizedEntities.push(`${raw} -> ${resolved}`);
                }
            });

            // --- STAGE 2: INTENT CLASSIFICATION ---
            if (io) io.emit("milestone", { node: "Analyst", msg: "🧠 Stage 2: Classifying analytical intent..." });

            const intentModel = await getAIModel("analyst_intent");
            const intentSystemPrompt = `You are the Intent Classification Agent. Your job is to classify the user's query into exactly one of these categories:
- count_by_field
- count_by_two_fields_pivot
- compare_specific_values
- trend_over_time
- top_n
- distribution

### TAXONOMY DEFINITION:
1. count_by_field: Simple count/sum grouped by one field.
2. count_by_two_fields_pivot: Multi-dimensional counts across columns and rows (e.g. "compare count of items in columns and rows").
3. compare_specific_values: Direct comparison of specific entities or values (e.g. "is laptops sales higher than printer sales").
4. trend_over_time: Groups by date/time field.
5. top_n: Highest, lowest, most, top entities.
6. distribution: Bucket ranges or histograms.

Return ONLY a JSON response:
{
  "intent": "category",
  "reasoning": "explanation"
}`;

            const intentResult = await intentModel.generateContent(
                `User Query: "${resPayload.cleanedQuery}"\nResolved Fields: ${JSON.stringify(mergedResolvedFields)}`,
                intentSystemPrompt,
                { response_format: { type: "json_object" } }
            );
            
            const intentPayload = JSON.parse(intentResult.response.text().replace(/```json|```/g, "").trim());
            intent = intentPayload.intent;

            // --- STAGE 3: TEMPLATE SLOT-FILLING & STAGE 5: RETRY LOOP ---
            let attempts = 0;
            const slotFillModel = await getAIModel("analyst_slotfill");

            while (attempts < 3) {
                if (io) io.emit("milestone", { node: "Analyst", msg: `📡 Stage 3: Slot-filling template parameters (Attempt ${attempts + 1}/3)...` });

                const availableSlots = TEMPLATES[intent]?.slots || [];
                const feedbackText = validationError ? `\n\n⚠️ PREVIOUS ATTEMPT FAILED VALIDATION:\n- Error: ${validationError}\nPlease correct the values.` : "";

                const slotSystemPrompt = `You are the Template Slot-Filling Agent. Your job is to map resolved fields, operations, and values to the designated parameter slots for the intent: "${intent}".

### Target Collection: "${collection}"
### Available Schema Fields & Meta:
${JSON.stringify(schemaObject[collection] || {}, null, 2)}

### Slots to fill:
${availableSlots.join(", ")}

### SLOT TYPES & FILLING INSTRUCTIONS:
1. Field Ref Slots (e.g., "group_field", "row_field", "col_field", "field", "metric_field", "date_field", "numeric_field"):
   - Fill with the exact database field name (e.g. "product", "region", "amount", "date", "status").
2. Value Slots (e.g., "value_a", "value_b"):
   - Fill with the raw comparative value/entity string from the query (e.g. "laptops", "printers", "Skopje", "Bitola", "M", "F", "Completed"). Do NOT output field names here.
3. Operation Slots (e.g., "agg_op"):
   - Fill with standard aggregate functions: "sum", "avg", "min", "max", "count". Do NOT output field names here.
4. Parameter Slots (e.g., "interval", "sort_order", "limit"):
   - "interval": "daily" | "monthly" | "yearly"
   - "sort_order": -1 | 1
   - "limit": integer number

### VAGUE QUERY GUIDELINES:
If the intent is "count_by_two_fields_pivot" and no specific fields are mentioned in the query (e.g., "compare rows and columns"), you MUST select the first two categorical string fields in the schema (e.g. for sales_data, map row_field to "region" and col_field to "product"). Never output "documents", "rows", or "columns" as slot values.

Return ONLY a JSON response mapping the slot names to their resolved parameters:
{
  ${availableSlots.map(s => `"${s}": "value"`).join(",\n  ")}
}${feedbackText}`;

                const slotResult = await slotFillModel.generateContent(
                    `Query: "${resPayload.cleanedQuery}"\nResolved Field Map: ${JSON.stringify(mergedResolvedFields)}`,
                    slotSystemPrompt,
                    { response_format: { type: "json_object" } }
                );

                slots = JSON.parse(slotResult.response.text().replace(/```json|```/g, "").trim());

                // --- STAGE 4: VALIDATION BEFORE EXECUTION ---
                if (io) io.emit("milestone", { node: "Analyst", msg: "🛡️ Stage 4: Performing guardrail validations..." });
                validationError = null;

                const fieldsInCollection = Object.keys(schemaObject[collection] || {});
                
                // Check 1: Do slots refer to real fields?
                for (const slotKey of availableSlots) {
                    const fieldVal = slots[slotKey];
                    // Skip optional slots that are null/empty or non-field parameters like sort_order, limit, agg_op, interval
                    if (!fieldVal || ["sort_order", "limit", "agg_op", "interval", "value_a", "value_b"].includes(slotKey)) continue;

                    if (!fieldsInCollection.includes(fieldVal)) {
                        validationError = `Field "${fieldVal}" mapped to slot "${slotKey}" does not exist in collection "${collection}". Closest fields: ${fieldsInCollection.join(", ")}`;
                        break;
                    }
                }

                // Check 2: Cardinality Checks (Block high-cardinality group-by)
                if (!validationError) {
                    const groupFields = ["group_field", "row_field", "col_field"].filter(k => slots[k]);
                    for (const gf of groupFields) {
                        const fieldName = slots[gf];
                        const fieldMeta = schemaObject[collection][fieldName];
                        // If field name looks like an ID field, block it
                        if (fieldName === "_id" || fieldName === "id" || fieldName.endsWith("_id")) {
                            validationError = `Grouping by high-cardinality ID field "${fieldName}" is blocked to prevent rendering an unreadable chart. Please choose a categorical field instead.`;
                            break;
                        }
                    }
                }

                // Check 3: Logical operations (Numeric check)
                if (!validationError && slots.metric_field && slots.agg_op) {
                    const fieldMeta = schemaObject[collection][slots.metric_field];
                    // If metric_field exists in schema and is not numeric, warn or block aggregation operations like $sum or $avg on it
                    // (Unless the operation is just a document count where metric_field is optional)
                }

                // Check 4: Resolve value_a and value_b casing
                if (!validationError) {
                    const targetField = slots.field || slots.group_field;
                    if (targetField && schemaObject[collection][targetField]) {
                        const allowedVals = schemaObject[collection][targetField].values || [];
                        if (slots.value_a) {
                            slots.value_a = resolveCategoricalValue(slots.value_a, allowedVals);
                        }
                        if (slots.value_b) {
                            slots.value_b = resolveCategoricalValue(slots.value_b, allowedVals);
                        }
                    }
                }

                if (!validationError) {
                    // Passed validation!
                    break;
                }

                // Loop retry triggered if validation failed
                attempts++;
            }

            if (validationError) {
                throw new Error(`Pipeline Validation Failed after 3 attempts. Last error: ${validationError}`);
            }
        }

        // Build the aggregation pipeline using the rigid templates
        pipeline = TEMPLATES[intent].build(slots);

        // Security check
        validatePipeline(pipeline);

        // Execute query against MongoDB
        if (io) io.emit("milestone", { node: "Analyst", msg: `📡 Executing Aggregation Strategy on collection "${collection}"...` });

        const client = new MongoClient(process.env.MONGODB_READONLY_URI || process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.DB_NAME || "agentic_db");
        const dbCollection = db.collection(collection);

        const data = await dbCollection.aggregate(pipeline).toArray();
        await client.close();

        // Write Observability logs
        logObservability({
            timestamp: new Date().toISOString(),
            originalQuery: conceptualQuery,
            resolvedCollection: collection,
            resolvedIntent: intent,
            slots: slots,
            generatedPipeline: pipeline,
            status: data.length > 0 ? "success" : "empty_result"
        });

        if (data.length === 0) {
            return {
                dataContext: {
                    ...state.dataContext,
                    rawData: [],
                    lastCollection: collection,
                    mongoError: "No matching data found.",
                    lastStep: "analysis-empty"
                }
            };
        }

        // Map intent to plot_type for visualization manifest
        let plotType = "bar";
        if (intent === "trend_over_time") plotType = "line";
        else if (intent === "distribution") plotType = "scatter";

        const correctionNotice = Object.keys(corrections).length > 0 
            ? `Interpreted ${Object.entries(corrections).map(([raw, resolved]) => `'${raw}' as '${resolved}'`).join(", ")}.`
            : null;

        return {
            dataContext: {
                ...state.dataContext,
                rawData: data,
                lastCollection: collection,
                visualManifest: {
                    plot_type: plotType,
                    x: "category",
                    y: "value",
                    title: `${intent.replace(/_/g, " ").toUpperCase()}: ${collection}`
                },
                correctionNotice: correctionNotice,
                normalizedEntities: normalizedEntities,
                lastStep: "analysis-success"
            }
        };

    } catch (error) {
        console.error("❌ Analyst Failed:", error.message);
        if (io) io.emit("milestone", { node: "Analyst", msg: `❌ Analysis Error: ${error.message}`, error: true });

        // Log observability failure
        logObservability({
            timestamp: new Date().toISOString(),
            originalQuery: conceptualQuery,
            status: "failed",
            error: error.message
        });

        return {
            dataContext: {
                ...state.dataContext,
                mongoError: error.message,
                lastStep: "analysis-failed"
            }
        };
    }
}

/**
 * Pipeline security and validation
 */
function validatePipeline(pipeline) {
    if (!Array.isArray(pipeline)) {
        throw new Error("Invalid Pipeline: Must be an array.");
    }
    const blacklistedStages = ["$out", "$merge", "$collStats", "$planCache"];
    pipeline.forEach(stage => {
        const stageName = Object.keys(stage)[0];
        if (blacklistedStages.includes(stageName)) {
            throw new Error(`Security Violation: Pipeline contains forbidden stage '${stageName}'.`);
        }
    });
}

/**
 * Observability logging utility
 */
function logObservability(logEntry) {
    try {
        const logDir = path.join(process.cwd(), "output");
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const logPath = path.join(logDir, "analyst_observability.json");
        
        let success = false;
        let retries = 0;
        while (!success && retries < 5) {
            try {
                let logs = [];
                if (fs.existsSync(logPath)) {
                    const fileData = fs.readFileSync(logPath, "utf8").trim();
                    if (fileData) {
                        logs = JSON.parse(fileData);
                    }
                }
                logs.push(logEntry);
                if (logs.length > 100) {
                    logs = logs.slice(-100);
                }
                fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), "utf8");
                success = true;
            } catch (writeErr) {
                if (writeErr.code === "EBUSY" || writeErr.code === "EPERM") {
                    retries++;
                    // sleep 200ms using a simple loop or Atomics
                    const sab = new Int32Array(new SharedArrayBuffer(4));
                    Atomics.wait(sab, 0, 0, 200);
                } else {
                    throw writeErr;
                }
            }
        }
    } catch (err) {
        console.error("⚠️ Failed to write analyst observability log:", err.message);
    }
}
