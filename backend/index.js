import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";
import { Annotation, messagesStateReducer, StateGraph, START, END } from "@langchain/langgraph";
import { discoveryNode } from "./services/discoveryNode.js";
import { plannerNode } from "./services/planner.js";
import { parallelRunnerNode } from "./services/parallelRunner.js";
import { compositorNode } from "./services/compositor.js";
import { summarizerNode } from "./services/summarizer.js";
import { analystNode } from "./services/analyst.js";
import { generatorNode } from "./services/generator.js";
import { ingestData, ingestUserEntry } from "./api/ingest.js";
import { exportData, exportDashboardToPDF } from "./services/exporter.js";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { mcpRegistry } from "./mcp/registry.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve static plots
app.use("/temp_plots", express.static("public/temp_plots"));

/**
 * AGENT STATE
 */
const AgentState = Annotation.Root({
  messages: Annotation({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  dataContext: Annotation({
    reducer: (current, next) => ({ ...current, ...next }),
    default: () => ({}),
  }),
  lastError: Annotation({
    reducer: (current, next) => next,
    default: () => null,
  }),
  retryCount: Annotation({
    reducer: (current, next) => next,
    default: () => 0,
  }),
});

// THE SELF-CORRECTION LOGIC (Single Chart only)
function shouldContinue(state) {
    const error = state.lastError || state.dataContext.lastError || state.dataContext.vizError;
    const retryCount = state.retryCount !== undefined ? state.retryCount : (state.dataContext.retryCount || 0);
    if (error && retryCount < 3) return "analyst";
    return "summarizer";
}

// 1. SINGLE-CHART GRAPH (Old Workflow)
const singleWorkflow = new StateGraph(AgentState)
  .addNode("discovery", discoveryNode)
  .addNode("analyst", analystNode)
  .addNode("generator", generatorNode)
  .addNode("summarizer", summarizerNode)
  .addEdge(START, "discovery")
  .addEdge("discovery", "analyst")
  .addEdge("analyst", "generator")
  .addConditionalEdges("generator", shouldContinue)
  .addEdge("summarizer", END);

const singleChartGraph = singleWorkflow.compile();

// 2. MULTI-CHART GRAPH (New Map-Reduce Workflow)
const multiWorkflow = new StateGraph(AgentState)
  .addNode("discovery", discoveryNode)
  .addNode("planner", plannerNode)
  .addNode("runner", parallelRunnerNode)
  .addNode("compositor", compositorNode)
  .addNode("summarizer", summarizerNode)
  .addEdge(START, "discovery")
  .addEdge("discovery", "planner")
  .addEdge("planner", "runner")
  .addEdge("runner", "compositor")
  .addEdge("compositor", "summarizer")
  .addEdge("summarizer", END);

const multiChartGraph = multiWorkflow.compile();

/**
 * CLEANUP SCRIPT
 * Deletes plots older than 24 hours.
 */
function cleanupPlots() {
    const directory = "public/temp_plots";
    const now = Date.now();
    const expiration = 24 * 60 * 60 * 1000;

    if (!fs.existsSync(directory)) return;

    fs.readdir(directory, (err, files) => {
        if (err) return console.error("Cleanup Error:", err);
        files.forEach(file => {
            const filePath = path.join(directory, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                if (now - stats.mtimeMs > expiration) {
                    fs.unlink(filePath, () => {});
                }
            });
        });
    });
}
setInterval(cleanupPlots, 60 * 60 * 1000); // Run every hour

/**
 * SOCKET.IO MILESTONES
 */
io.on("connection", (socket) => {
    console.log("🔌 Frontend connected to Socket.io HUD");
});

/**
 * API ENDPOINTS
 */

app.post("/api/plan", async (req, res) => {
    const { query } = req.body;
    console.log("🗺️ Generating plan for query:", query);
    try {
        const state1 = await discoveryNode({
            dataContext: {
                conceptualQuery: query || "Summarize the data",
                io: io,
                mode: "multichart"
            }
        });
        const state2 = await plannerNode(state1);
        res.json({
            success: true,
            goals: state2.dataContext.goals,
            schema: state2.dataContext.schema,
            schemaObject: state2.dataContext.schemaObject
        });
    } catch (error) {
        console.error("❌ Plan Generation Failed:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/analyze", async (req, res) => {
    console.log("🚀 Incoming Request: Analysis Triggered.");
    const isMultiChart = req.body.mode === "multichart";
    const graphToInvoke = isMultiChart ? multiChartGraph : singleChartGraph;

    try {
        const result = await graphToInvoke.invoke({ 
            dataContext: { 
                retryCount: 0,
                conceptualQuery: req.body.query || null,
                io: io, // Pass socket to nodes
                mode: req.body.mode || "single",
                goals: req.body.goals || null,
                isPlanApproved: req.body.isPlanApproved || false
            },
            lastError: null,
            retryCount: 0
        }, {
            recursionLimit: 100,
            configurable: { thread_id: "agentic-analyst-session" }
        });
        
        // Remove io before sending response
        const responseData = { ...result.dataContext };
        delete responseData.io;

        res.json({ success: true, data: responseData });
    } catch (error) {
        console.error("❌ Agent Failed:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/ingest", async (req, res) => {
    const { rawData, format, collectionName } = req.body;
    try {
        const result = await ingestData(rawData, format, collectionName);
        res.json({ success: true, count: result.insertedCount, summary: result.summary });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/ingest/user", async (req, res) => {
    const { rawData } = req.body;
    try {
        const result = await ingestUserEntry(rawData);
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get("/api/export", async (req, res) => {
    try {
        const filePath = await exportData();
        res.json({ success: true, filePath: filePath });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/export/pdf", async (req, res) => {
    const { title, cards } = req.body;
    try {
        const pdfBuffer = await exportDashboardToPDF(title, cards);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=dashboard_report.pdf");
        res.send(pdfBuffer);
    } catch (error) {
        console.error("❌ PDF Export failed:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/explain", async (req, res) => {
    const { chartTitle, query, rawData } = req.body;
    try {
        const { getAIModel } = await import("./lib/aiService.js");
        const model = await getAIModel("summarizer");
        const systemPrompt = `You are the User-Facing Analyst Liaison.
Your job is to take a visual chart title, the query used to generate it, and its raw data, and provide a deep-dive narrative explanation (3-4 sentences) that highlights key trends, statistical anomalies, or strategic insights. Keep it professional, insightful, and formatted in markdown.`;
        const userPrompt = `Chart Title: "${chartTitle}"\nQuery: "${query}"\nRaw Data (first 30 records):\n${JSON.stringify(rawData ? rawData.slice(0, 30) : [])}`;
        const result = await model.generateContent(userPrompt, systemPrompt);
        res.json({ success: true, explanation: result.response.text() });
    } catch (error) {
        console.error("❌ Explanation generation failed:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/health", async (req, res) => {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        res.json({ success: true, status: "connected" });
    } catch (error) {
        res.status(500).json({ success: false, status: "disconnected", error: error.message });
    } finally {
        await client.close();
    }
});

// MCP ENDPOINTS
app.get("/api/mcp/tools", async (req, res) => {
    const list = [];
    for (const [name, client] of mcpRegistry.servers.entries()) {
        try {
            const result = await client.sendRequest("tools/list");
            list.push({ server: name, tools: result.tools });
        } catch (e) {
            list.push({ server: name, error: e.message });
        }
    }
    res.json({ success: true, servers: list });
});

app.post("/api/mcp/call", async (req, res) => {
    const { server, tool, arguments: args } = req.body;
    try {
        const result = await mcpRegistry.callTool(server, tool, args);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

server.listen(port, async () => {
    console.log(`🤖 Agentic API is LISTENING at http://localhost:${port}`);
    cleanupPlots(); // Initial cleanup
    await mcpRegistry.init();
});

// Process Teardown Handlers
process.on("SIGINT", async () => {
    await mcpRegistry.shutdown();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await mcpRegistry.shutdown();
    process.exit(0);
});
