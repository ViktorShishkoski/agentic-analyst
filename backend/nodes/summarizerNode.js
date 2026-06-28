import { getAIModel } from "../lib/aiService.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * 📝 SUMMARIZER NODE
 * 
 * Generates a professional, insight-driven summary of the retrieved data.
 */
export async function summarizerNode(state) {
    const io = state.dataContext.io;
    if (io) io.emit("milestone", { node: "Summarizer", msg: "📝 Synthesizing Strategic Insights..." });

    console.log("📝 Node: Summarizer (Generating Insights)...");

    const model = await getAIModel();

    const query = state.dataContext.conceptualQuery || "general analysis";
    const mongoData = state.dataContext.mongoOutput || [];
    const schema = state.dataContext.schema || "Unknown";

    const prompt = `
    ROLE: Senior Data Analyst.
    TASK: Provide a concise, high-impact summary of the analysis results.
    
    USER QUERY: ${query}
    SCHEMA CONTEXT: ${schema}
    DATA RESULTS (First 5 records): ${JSON.stringify(mongoData.slice(0, 5))}

    GOALS:
    1. Explain the "Why" behind the data.
    2. Identify a single key trend or outlier.
    3. Keep it under 3 sentences.
    4. Maintain a professional "Enterprise AI" tone.
    `;

    try {
        const result = await model.generateContent(prompt);
        const insight = result.response.text().trim();

        if (io) io.emit("milestone", { node: "Summarizer", msg: "✨ Intelligence Synthesis Complete." });

        return {
            dataContext: {
                ...state.dataContext,
                insight: insight,
                lastStep: "summarization-complete"
            }
        };
    } catch (error) {
        console.error("❌ Summarizer Failed:", error);
        if (io) io.emit("milestone", { node: "Summarizer", msg: "⚠️ Summarization skipped due to error.", error: true });
        return {
            dataContext: {
                ...state.dataContext,
                insight: "Data analysis complete. Insights deferred to visual inspection.",
                lastStep: "summarization-failed"
            }
        };
    }
}
