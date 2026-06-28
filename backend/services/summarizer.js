import { getAIModel } from "../lib/aiService.js";

/**
 * 📝 SUMMARIZER SERVICE
 * Generates human-readable insights.
 * INFRASTRUCTURE RECOVERY: Enhanced error reporting.
 */
export async function summarizerNode(state) {
    const io = state.dataContext.io;
    const mongoError = state.dataContext.mongoError;
    const vizError = state.dataContext.vizError;

    // Skip if it was just a discovery query
    if (state.dataContext.lastStep === "discovery-only") {
        return {
            dataContext: {
                ...state.dataContext,
                insight: "Schema discovery complete. Awaiting specific analytical query.",
                lastStep: "summarization-skipped"
            }
        };
    }

    // 1. Check for Upstream Failures (Strategic Reporting)
    if (mongoError || vizError) {
        // Data Entry Rules (Help Box) as per Orchestrator Protocol
        const dataEntryRules = `
🛠️ Data Entry Rules
To ensure a perfect analysis cycle, follow these formats:
- For CSV Files: Compare [Column A] with [Column B] where [Filter Column] is [Value].
- For JSON Files: Ensure the file is an array of objects.
- If data is nested (e.g., stats.points), tell me: "Use the nested field 'stats.points'".
- Avoid "mixed types" (don't put "100" as a string in one record and 100 as a number in another).`;

        // Handle "No matching data found" as a friendly insight rather than an error
        if (mongoError === "No matching data found for this query.") {
            return {
                dataContext: {
                    ...state.dataContext,
                    insight: `I couldn't find any data matching your specific request. Please try broadening your search or checking the spelling of categories.${dataEntryRules}`,
                    lastStep: "summarization-no-data"
                }
            };
        }

        const errorMsg = mongoError 
            ? `🛑 Analysis Blocked: ${mongoError}` 
            : `⚠️ Visualization Deferred: ${vizError}`;
        
        console.warn(errorMsg);
        if (io) io.emit("milestone", { node: "Summarizer", msg: errorMsg, error: true });
        
        return {
            dataContext: {
                ...state.dataContext,
                insight: `Infrastructure Warning: ${mongoError || vizError}. The analysis pipeline was interrupted.${dataEntryRules}`,
                lastStep: "summarization-error-report"
            }
        };
    }

    if (io) io.emit("milestone", { node: "Summarizer", msg: "📝 Synthesizing Strategic Insights..." });

    try {
        const model = await getAIModel();
        const rawData = state.dataContext.rawData || [];
        const query = state.dataContext.conceptualQuery || "";
        const correctionNotice = state.dataContext.correctionNotice || null;
        const normalizedEntities = state.dataContext.normalizedEntities || [];

        const distilledData = distillData(rawData);

        const systemPrompt = `You are the Insight Generation Agent for a data analysis platform. Your role is to take structured query results and present them in an analytical, highly readable format.

        ### RESPONSE ARCHITECTURE (you MUST follow this exact structure):

        1. ACKNOWLEDGMENT & CORRECTION NOTICE (only if relevant):
           - If the original query contained typos, erratic casing, or shorthand that was corrected by the Parsing Agent, start with a brief, polite notice.
           - Format: "Analyzing data for: [Normalized Entity A] vs. [Normalized Entity B]." or "Interpreted '[raw term]' as '[corrected term]'."
           - If normalizedEntities is empty or no correction was made, SKIP this section entirely.

        2. DIRECT SUMMARY:
           - Lead with ONE clear, concise sentence summarizing the core comparative finding.
           - ALWAYS include specific numeric values with explicit units (e.g., "lbs", "kg", "points", "%").
           - Example: "On average, the Houston Rockets roster is heavier than the Boston Celtics by 14.3 lbs."

        3. STRUCTURED DATA TABLE:
           - Present the data breakdown as a clean Markdown comparison table.
           - Always include column headers. Label numeric columns with units where applicable.
           - If there are more than 10 rows, show only the top 5 and bottom 5 by value.

        4. KEY ANCHORS / OUTLIERS:
           - Call out the single highest and lowest data point that most heavily skews or anchors the average.
           - Mention their specific values with units.
           - Example: "Notable outlier: Boban Marjanović weighs 290 lbs, significantly pulling up the Mavericks' average."

        ### TONE & CONSTRAINTS:
        - Use a helpful, analytical peer voice. Not dry or textbook, not fluffy.
        - All numeric values MUST include correct units explicitly.
        - Do not add generic filler phrases like "Great question!" or "It's worth noting that..."

        Return ONLY a JSON object:
        {
          "summary": "string (full markdown-formatted insight following the architecture above)"
        }
        Do not wrap in code blocks or add any text outside the JSON.`;

        const prompt = `ORIGINAL QUERY: ${query}
CORRECTION NOTICE FROM PARSING AGENT: ${correctionNotice || "None"}
NORMALIZED ENTITIES: ${normalizedEntities.length > 0 ? normalizedEntities.join(", ") : "None"}
DATA SUMMARY:
${distilledData}
FULL RAW DATA (for outlier detection):
${JSON.stringify(rawData.slice(0, 20), null, 2)}`;

        const result = await model.generateContent(prompt, systemPrompt, { max_tokens: 1500 });
        const cleanResponse = result.response.text().replace(/```json|```/g, "").trim();
        let insight;
        try {
            insight = JSON.parse(cleanResponse).summary;
        } catch (parseErr) {
            console.warn("⚠️ Summarizer failed to parse JSON, attempting raw extraction:", parseErr.message);
            const match = cleanResponse.match(/"summary"\s*:\s*"([\s\S]*)"\s*}/) || cleanResponse.match(/"summary"\s*:\s*"([\s\S]*)$/);
            insight = match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() : cleanResponse;
        }

        if (io) io.emit("milestone", { node: "Summarizer", msg: "✨ Intelligence Synthesis Complete." });

        return {
            dataContext: {
                ...state.dataContext,
                insight: insight,
                lastStep: "summarization-complete"
            }
        };
    } catch (error) {
        console.error("Summarizer Failed:", error.message);
        return {
            dataContext: {
                ...state.dataContext,
                insight: "Summary deferred due to AI infrastructure latency.",
                lastStep: "summarization-failed"
            }
        };
    }
}

/**
 * distillData
 * Reduces raw MongoDB results into a labeled, unit-aware summary string for the AI.
 * Includes per-category stats and top/bottom outliers for Insight Generation Agent context.
 */
function distillData(rawData) {
    if (!rawData || rawData.length === 0) return "No data available.";

    const count = rawData.length;
    const keys = Object.keys(rawData[0]);

    const numericFields = keys.filter(k => typeof rawData[0][k] === 'number');
    const categoricalFields = keys.filter(k => typeof rawData[0][k] === 'string');

    let summary = `Total Records: ${count}\n`;

    // 1. Numeric Stats per field: Avg, Min, Max + top/bottom outliers
    numericFields.forEach(field => {
        const sorted = [...rawData]
            .map(d => ({ label: d.category || d._id || JSON.stringify(d), val: d[field] }))
            .filter(d => d.val !== undefined && d.val !== null)
            .sort((a, b) => b.val - a.val);

        if (sorted.length === 0) return;

        const values = sorted.map(d => d.val);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const min = values[values.length - 1];
        const max = values[0];

        summary += `\nField: "${field}"\n`;
        summary += `  Average: ${avg.toFixed(2)} | Max: ${max} (${sorted[0].label}) | Min: ${min} (${sorted[sorted.length - 1].label})\n`;

        // Top 3 and bottom 3 for outlier anchoring
        const top3 = sorted.slice(0, 3).map(d => `  - ${d.label}: ${d.val.toFixed(2)}`).join("\n");
        const bottom3 = sorted.slice(-3).reverse().map(d => `  - ${d.label}: ${d.val.toFixed(2)}`).join("\n");
        summary += `  Top 3:\n${top3}\n  Bottom 3:\n${bottom3}\n`;
    });

    // 2. Categorical frequency (top 5)
    categoricalFields.forEach(field => {
        const frequencies = {};
        rawData.forEach(d => {
            const val = d[field] || "N/A";
            frequencies[val] = (frequencies[val] || 0) + 1;
        });

        const top5 = Object.entries(frequencies)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([val, freq]) => `${val} (${freq} records)`);

        summary += `\nTop 5 values for "${field}": ${top5.join(", ")}\n`;
    });

    return summary;
}
