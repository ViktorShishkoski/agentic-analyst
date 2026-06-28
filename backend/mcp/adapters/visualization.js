import readline from "readline";
import { exec } from "child_process";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import os from "os";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

function runChartRenderer(config) {
    return new Promise((resolve, reject) => {
        const tempDir = os.tmpdir();
        const configPath = path.join(tempDir, `chart_config_${Date.now()}.json`);
        
        // Write config object to temp file
        fs.writeFileSync(configPath, JSON.stringify(config));

        const scriptPath = path.join(rootDir, "skill", "scripts", "chart_renderer.py");
        const command = `python "${scriptPath}" "${configPath}"`;
        
        exec(command, { env: process.env }, (error, stdout, stderr) => {
            // Cleanup config file
            try {
                fs.unlinkSync(configPath);
            } catch (e) {}

            if (error) {
                reject(new Error(stderr || error.message));
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

async function handleRequest(request) {
    const { id, method, params } = request;

    if (method === "tools/list") {
        return {
            tools: [
                {
                    name: "render_chart",
                    description: "Render a dataset chart using the Plotly-based engine",
                    inputSchema: {
                        type: "object",
                        properties: {
                            plot_type: { type: "string" },
                            x: { type: "string" },
                            y: { type: "string" },
                            title: { type: "string" },
                            data_path: { type: "string" },
                            orientation: { type: "string" }
                        },
                        required: ["plot_type", "x", "data_path"]
                    }
                }
            ]
        };
    }

    if (method === "tools/call") {
        const { name, arguments: args } = params;

        try {
            if (name === "render_chart") {
                const output = await runChartRenderer(args);
                return {
                    content: [{ type: "text", text: output }]
                };
            }

            throw new Error(`Tool not found: ${name}`);
        } catch (err) {
            return {
                isError: true,
                content: [{ type: "text", text: err.message }]
            };
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
