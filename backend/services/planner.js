import { getAIModel } from "../lib/aiService.js";

/**
 * 🗺️ PLANNER SERVICE
 * Decomposes broad user requests into structured visual goals.
 * Performs pre-flight schema mapping and auto-correction.
 */
export async function plannerNode(state) {
  const io = state.dataContext.io;

  if (state.dataContext.goals && state.dataContext.goals.length > 0 && state.dataContext.isPlanApproved) {
    if (io) io.emit("milestone", { node: "Planner", msg: "🗺️ Using approved execution plan. Skipping decomposition." });
    return {
      dataContext: {
        ...state.dataContext,
        lastStep: "planner-approved-skipped"
      }
    };
  }

  if (io) io.emit("milestone", { node: "Planner", msg: "🗺️ Analyzing complex user query and decomposing goals..." });

  const schema = state.dataContext.schema || "";
  const schemaObject = state.dataContext.schemaObject || {};
  const conceptualQuery = state.dataContext.conceptualQuery || "Summarize the data";

  // Build target anchors list for the LLM context
  let dynamicValidTargets = "";
  for (const [colName, fields] of Object.entries(schemaObject)) {
    dynamicValidTargets += `- Collection Name: "${colName}"\n`;
    for (const [fieldName, fieldMeta] of Object.entries(fields)) {
      const typesStr = fieldMeta.types ? ` (${fieldMeta.types.join('/')})` : '';
      dynamicValidTargets += `  * Field Name: "${fieldName}"${typesStr}\n`;
    }
  }

  const systemPrompt = `You are the Goal Decomposer and Planner Node for an advanced data analysis system.
Your job is to take a user's multi-intent query, inspect the database schema, and split the query into a discrete list of individual visual chart objectives.

### DATABASE SCHEMA & VALID ANCHORS
Only query the collections and fields listed below:
${dynamicValidTargets}

### RULES FOR DECOMPOSITION
1. MULTI-INTENT SPLITTING: Split complex requests (e.g. "show me sales over time and top products") into multiple discrete goals (e.g. Goal 1: Sales over time, Goal 2: Top products by sales). Max 4 goals.
2. SCHEMA VALIDATION: Cross-reference fields in the query against the DUB/VALID ANCHORS. 
   - If the user requests a field that does not exist in the schema, map it to the closest valid field name using semantic matching.
   - If no close match exists, drop the request or correct it before execution.
   - Do NOT reference any collections or fields that are not in the schema.
3. DETERMINISTIC CHART SELECTION:
   - Date/Time field + Numeric field -> "line"
   - Categorical field + Numeric field -> "bar" (set orientation to "h" if more than 7 categories)
   - Numeric field + Numeric field -> "scatter"
   - Low-cardinality Categorical field (less than 7 unique values) + Count -> "pie"
   - Ignore this rule ONLY if the user explicitly specifies the chart type in the prompt (e.g. "show as scatter").

### OUTPUT FORMAT
You MUST return a JSON response with this exact structure (do not include markdown code block syntax or any introductory text):
{
  "goals": [
    {
      "id": "goal_1",
      "intent": "Brief description of the analysis goal",
      "collection": "exact_collection_name_from_schema",
      "chart_type": "bar | line | scatter | pie",
      "x_field": "exact_field_name_from_schema",
      "y_field": "exact_field_name_from_schema",
      "agg": "sum | avg | count | min | max",
      "title": "Title for the visual chart container"
    }
  ]
}

MASTER SCHEMA CONTEXT:
${schema}`;

  try {
    const model = await getAIModel("planner");
    const result = await model.generateContent("User Request: " + conceptualQuery, systemPrompt, {
      response_format: { type: "json_object" }
    });

    const parsedResult = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
    const goals = parsedResult.goals || [];

    if (io) io.emit("milestone", { node: "Planner", msg: `✅ Successfully decomposed query into ${goals.length} distinct goals.` });

    return {
      dataContext: {
        ...state.dataContext,
        goals: goals,
        lastStep: "planner-complete"
      }
    };
  } catch (error) {
    console.error("❌ Planner Node Failed:", error.message);
    if (io) io.emit("milestone", { node: "Planner", msg: `❌ Planner Error: ${error.message}`, error: true });
    
    // Fallback: create a single generic goal based on first collection/fields in the schema
    const firstCol = Object.keys(schemaObject)[0] || "sales_data";
    const fields = schemaObject[firstCol] ? Object.keys(schemaObject[firstCol]) : ["_id"];
    const fallbackGoals = [{
      id: "goal_fallback",
      intent: "Data overview",
      collection: firstCol,
      chart_type: "bar",
      x_field: fields[1] || fields[0],
      y_field: fields[2] || fields[0],
      agg: "count",
      title: "Data Overview (Fallback)"
    }];

    return {
      dataContext: {
        ...state.dataContext,
        goals: fallbackGoals,
        lastStep: "planner-fallback"
      }
    };
  }
}
