import readline from "readline";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
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

function runPythonScript(scriptName, args = []) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(rootDir, "skill", "scripts", scriptName);
        const command = `python "${scriptPath}" ${args.map(a => `"${a}"`).join(" ")}`;
        
        exec(command, { env: process.env }, (error, stdout, stderr) => {
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
                    name: "detect_format",
                    description: "Auto-detect file format, delimiter, types, and column profiling",
                    inputSchema: {
                        type: "object",
                        properties: {
                            filepath: { type: "string" }
                        },
                        required: ["filepath"]
                    }
                },
                {
                    name: "profile_mongodb",
                    description: "Profiles a MongoDB database or collection",
                    inputSchema: {
                        type: "object",
                        properties: {
                            db: { type: "string" },
                            collection: { type: "string" }
                        }
                    }
                }
            ]
        };
    }

    if (method === "tools/call") {
        const { name, arguments: args } = params;

        try {
            if (name === "detect_format") {
                const output = await runPythonScript("ingest_detector.py", [args.filepath]);
                return {
                    content: [{ type: "text", text: output }]
                };
            }

            if (name === "profile_mongodb") {
                const scriptArgs = [];
                if (args.db) scriptArgs.push("--db", args.db);
                if (args.collection) scriptArgs.push("--collection", args.collection);
                
                const output = await runPythonScript("schema_profiler.py", scriptArgs);
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
