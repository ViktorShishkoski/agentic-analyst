import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { getAIModel } from "../lib/aiService.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * 🧠 GENERATOR NODE
 * 
 * CORE PRINCIPLE: Configuration-Driven Visualization.
 * NEVER writes raw R code. Outputs a JSON config object.
 */
export async function generatorNode(state) {
    const io = state.dataContext.io;
    const retryCount = state.dataContext.retryCount || 0;
    const prevError = state.dataContext.rError || null;

    if (io) io.emit("milestone", { 
        node: "Generator", 
        msg: retryCount > 0 ? `🔄 Retrying Visualization (Attempt ${retryCount}/3)...` : "🎨 Architecting Visualization Config..." 
    });

    const model = await getAIModel();

    const mongoData = state.dataContext.mongoOutput || [];
    const schema = state.dataContext.schema || "";
    const query = state.dataContext.conceptualQuery || "";

    const systemPrompt = `
    ROLE: Senior Full-Stack AI Engineer.
    TASK: Generate a JSON configuration for an R ggplot2 template.
    
    CORE PRINCIPLES:
    1. No Raw Code: Return ONLY a JSON object.
    2. Visual Mapping Heuristics:
       - 1 Categorical + 1 Numeric -> "bar"
       - 2 Numeric -> "scatter"
       - Time Series -> "line" (set isTimeSeries: true)
       - Distribution -> "box"
    
    SCHEMA MINI-MAP:
    ${schema}
    
    DATA PREVIEW (First 2 records):
    ${JSON.stringify(mongoData.slice(0, 2), null, 2)}
    
    ${prevError ? `PREVIOUS ERROR: ${prevError}. Adjust mapping and retry.` : ""}
    
    OUTPUT REQUIREMENT:
    Return ONLY a JSON object with:
    {
      "type": "bar" | "scatter" | "line" | "box",
      "x": "fieldName",
      "y": "fieldName",
      "color": "hexColor",
      "title": "Plot Title",
      "subtitle": "Subtitle",
      "xLabel": "X Axis Label",
      "yLabel": "Y Axis Label",
      "isTimeSeries": boolean
    }
    `;

    try {
        const result = await model.generateContent(systemPrompt + "\nUser Query: " + query);
        const config = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
        
        const plotId = uuidv4();
        const dataPath = path.join(process.cwd(), `scratch/data_${plotId}.json`);
        const configPath = path.join(process.cwd(), `scratch/config_${plotId}.json`);
        const outputPath = path.join(process.cwd(), `public/temp_plots/plot_${plotId}.png`);
        const relativeUrl = `/temp_plots/plot_${plotId}.png`;

        // Create scratch dir if missing
        if (!fs.existsSync("scratch")) fs.mkdirSync("scratch");

        // Write files for R
        fs.writeFileSync(dataPath, JSON.stringify(mongoData));
        fs.writeFileSync(configPath, JSON.stringify(config));

        if (io) io.emit("milestone", { node: "Generator", msg: "🚀 Spawning R Engine for rendering..." });

        try {
            // Execute R Script via spawn/exec (template)
            execSync(`Rscript universal_analyst.R "${dataPath}" "${configPath}" "${outputPath}"`);
            
            // Success! Cleanup temp files
            fs.unlinkSync(dataPath);
            fs.unlinkSync(configPath);

            if (io) io.emit("milestone", { node: "Generator", msg: "✨ Visualization Synthesized Successfully." });

            return {
                dataContext: {
                    ...state.dataContext,
                    isVisual: true,
                    plotUrl: relativeUrl,
                    vizConfig: config,
                    lastStep: "generator-success",
                    rError: null // Clear errors on success
                }
            };
        } catch (rError) {
            console.error("❌ R Execution Failed:", rError.message);
            
            // Trigger retry loop via State-Aware Error Recovery
            if (retryCount < 2) {
                return {
                    dataContext: {
                        ...state.dataContext,
                        retryCount: retryCount + 1,
                        rError: rError.message,
                        lastStep: "generator-retry"
                    }
                };
            } else {
                throw new Error(`R Engine failed after 3 attempts: ${rError.message}`);
            }
        }

    } catch (error) {
        console.error("❌ Generator Failed:", error);
        if (io) io.emit("milestone", { node: "Generator", msg: `❌ Generator Error: ${error.message}`, error: true });
        return {
            dataContext: {
                ...state.dataContext,
                error: error.message,
                lastStep: "generator-failed"
            }
        };
    }
}
