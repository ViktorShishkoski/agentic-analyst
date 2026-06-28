import { spawn } from "child_process";
import readline from "readline";

/**
 * MCP Client Protocol Wrapper
 * Communicates with MCP servers using JSON-RPC 2.0 over stdio.
 */
export class MCPClient {
    constructor(name, command, args = [], env = {}) {
        this.name = name;
        this.command = command;
        this.args = args;
        this.env = { ...process.env, ...env };
        this.process = null;
        this.requestId = 1;
        this.pendingRequests = new Map();
    }

    start() {
        return new Promise((resolve, reject) => {
            try {
                this.process = spawn(this.command, this.args, {
                    env: this.env,
                    shell: true
                });

                const rl = readline.createInterface({
                    input: this.process.stdout,
                    terminal: false
                });

                rl.on("line", (line) => {
                    this.handleResponse(line);
                });

                this.process.stderr.on("data", (data) => {
                    console.warn(`[MCP Server ${this.name} STDERR]:`, data.toString());
                });

                this.process.on("close", (code) => {
                    console.log(`[MCP Server ${this.name}] process exited with code ${code}`);
                    this.cleanup(new Error(`MCP Server ${this.name} exited`));
                });

                this.process.on("error", (err) => {
                    console.error(`[MCP Server ${this.name}] spawn error:`, err);
                    reject(err);
                });

                // Small delay to ensure start
                setTimeout(() => resolve(this), 500);

            } catch (error) {
                reject(error);
            }
        });
    }

    sendRequest(method, params = {}) {
        if (!this.process) {
            return Promise.reject(new Error(`MCP Server ${this.name} is not running`));
        }

        return new Promise((resolve, reject) => {
            const id = this.requestId++;
            const payload = {
                jsonrpc: "2.0",
                id,
                method,
                params
            };

            this.pendingRequests.set(id, { resolve, reject, timer: setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`MCP Request ${method} timed out`));
            }, 15000) }); // 15 second timeout

            this.process.stdin.write(JSON.stringify(payload) + "\n");
        });
    }

    handleResponse(line) {
        try {
            const response = JSON.parse(line);
            if (response.id && this.pendingRequests.has(response.id)) {
                const { resolve, reject, timer } = this.pendingRequests.get(response.id);
                clearTimeout(timer);
                this.pendingRequests.delete(response.id);

                if (response.error) {
                    reject(response.error);
                } else {
                    resolve(response.result);
                }
            }
        } catch (e) {
            console.error(`[MCP Client ${this.name}] Failed to parse response:`, line, e);
        }
    }

    cleanup(error) {
        for (const [id, { reject, timer }] of this.pendingRequests.entries()) {
            clearTimeout(timer);
            reject(error || new Error("Connection closed"));
        }
        this.pendingRequests.clear();
        this.process = null;
    }

    async stop() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }
}
