import readline from "readline";
import { exec } from "child_process";
import fs from "fs";
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

function runExportHandler(args) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(rootDir, "skill", "scripts", "export_handler.py");
        
        let command = `python "${scriptPath}" --format "${args.format}" --input "${args.input}" --output "${args.output}"`;
        if (args.config) {
            command += ` --config "${args.config}"`;
        }

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
                    name: "read_file",
                    description: "Read the contents of a local file",
                    inputSchema: {
                        type: "object",
                        properties: {
                            filepath: { type: "string" }
                        },
                        required: ["filepath"]
                    }
                },
                {
                    name: "write_file",
                    description: "Writes content to a local file",
                    inputSchema: {
                        type: "object",
                        properties: {
                            filepath: { type: "string" },
                            content: { type: "string" }
                        },
                        required: ["filepath", "content"]
                    }
                },
                {
                    name: "export_report",
                    description: "Runs the export handler to output CSV, Excel, SVG, or PDF files",
                    inputSchema: {
                        type: "object",
                        properties: {
                            format: { type: "string" },
                            input: { type: "string" },
                            output: { type: "string" },
                            config: { type: "string" }
                        },
                        required: ["format", "input", "output"]
                    }
                }
            ]
        };
    }

    if (method === "tools/call") {
        const { name, arguments: args } = params;

        try {
            if (name === "read_file") {
                const content = fs.readFileSync(args.filepath, "utf8");
                return {
                    content: [{ type: "text", text: content }]
                };
            }

            if (name === "write_file") {
                const dir = path.dirname(args.filepath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(args.filepath, args.content, "utf8");
                return {
                    content: [{ type: "text", text: `SUCCESS: Wrote file to ${args.filepath}` }]
                };
            }

            if (name === "export_report") {
                const output = await runExportHandler(args);
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
