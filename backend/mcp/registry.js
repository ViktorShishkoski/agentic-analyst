import { fileURLToPath } from "url";
import path from "path";
import { MCPClient } from "./protocol.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MCPRegistry {
    constructor() {
        this.servers = new Map();
    }

    async init() {
        console.log("🛠️ Initializing MCP Server Registry...");
        
        // Define servers pointing to our adapters
        const adapters = [
            { name: "database", script: path.join(__dirname, "adapters", "database.js") },
            { name: "analytics", script: path.join(__dirname, "adapters", "analytics.js") },
            { name: "visualization", script: path.join(__dirname, "adapters", "visualization.js") },
            { name: "filesystem", script: path.join(__dirname, "adapters", "filesystem.js") }
        ];

        for (const adapter of adapters) {
            const scriptPath = adapter.script;
            try {
                const client = new MCPClient(
                    adapter.name,
                    "node",
                    [scriptPath],
                    { MONGODB_URI: process.env.MONGODB_URI }
                );
                
                await client.start();
                this.servers.set(adapter.name, client);
                console.log(`✅ Started MCP Server: ${adapter.name}`);
            } catch (err) {
                console.error(`❌ Failed to start MCP Server ${adapter.name}:`, err);
            }
        }
    }

    async callTool(serverName, toolName, argumentsObject = {}) {
        const client = this.servers.get(serverName);
        if (!client) {
            throw new Error(`MCP Server "${serverName}" is not registered or running.`);
        }
        
        // standard MCP tool call structure
        return await client.sendRequest("tools/call", {
            name: toolName,
            arguments: argumentsObject
        });
    }

    async shutdown() {
        console.log("🔌 Shutting down all MCP Servers...");
        for (const [name, client] of this.servers.entries()) {
            await client.stop();
            console.log(`stopped MCP Server: ${name}`);
        }
        this.servers.clear();
    }
}

export const mcpRegistry = new MCPRegistry();
