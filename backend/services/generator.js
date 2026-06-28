import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import crypto from "crypto";

/**
 * 🎨 GENERATOR SERVICE
 * Standardized hand-off to Python/R Cyberpunk Visualization Engines.
 * Supports session isolation and error feedback back to the analyst.
 */
export async function generatorNode(state) {
    const io = state.dataContext.io;
    const rawData = state.dataContext.rawData || [];
    const visualManifest = state.dataContext.visualManifest;
    const currentRetry = state.retryCount !== undefined ? state.retryCount : (state.dataContext.retryCount || 0);

    // 1. Centralized Check for Upstream Database Failures or Empty Datasets
    if (state.dataContext.mongoError || rawData.length === 0) {
        const errorMsg = state.dataContext.mongoError || "Empty dataset returned from MongoDB query. No records available to plot.";
        if (io) io.emit("milestone", { node: "Generator", msg: `⚠️ Query error or empty dataset: ${errorMsg}. Retrying...`, error: true });
        
        return {
            lastError: errorMsg,
            retryCount: currentRetry + 1,
            dataContext: {
                ...state.dataContext,
                lastError: errorMsg,
                retryCount: currentRetry + 1,
                lastStep: "generator-upstream-failed"
            }
        };
    }

    // 1.5 Quick Branching for Declarative Multi-Chart Plotly JSON Generator
    const isMultiChart = state.dataContext.mode === "multichart" || !!state.dataContext.goal;
    if (isMultiChart && visualManifest) {
        try {
            const xKey = visualManifest.x || "category";
            const yKey = visualManifest.y || "value";
            const chartType = (visualManifest.plot_type || "bar").toLowerCase();

            const xData = rawData.map(d => d[xKey] !== undefined ? d[xKey] : (d.category || d._id || ""));
            const yData = rawData.map(d => {
                const val = d[yKey] !== undefined ? d[yKey] : (d.value !== undefined ? d.value : d.result);
                const num = parseFloat(val);
                return isNaN(num) ? 0 : num;
            });

            let data = [];
            const brightColors = ['#FF6B35', '#00A8E8', '#FF9F1C', '#4EA8DE', '#F26419', '#33E1FF'];

            if (chartType === "bar") {
                data = [{
                    type: "bar",
                    x: xData,
                    y: yData,
                    marker: {
                        color: xData.map((_, i) => brightColors[i % brightColors.length]),
                        line: { color: "#ffffff", width: 1.5 }
                    }
                }];
            } else if (chartType === "line") {
                data = [{
                    type: "scatter",
                    mode: "lines+markers",
                    x: xData,
                    y: yData,
                    line: { color: "#00A8E8", width: 3 },
                    marker: { color: "#FF6B35", size: 8, line: { color: "#ffffff", width: 1 } }
                }];
            } else if (chartType === "scatter") {
                data = [{
                    type: "scatter",
                    mode: "markers",
                    x: xData,
                    y: yData,
                    marker: { color: "#FF6B35", size: 10, line: { color: "#00A8E8", width: 1.5 } }
                }];
            } else if (chartType === "pie") {
                data = [{
                    type: "pie",
                    labels: xData,
                    values: yData,
                    marker: { colors: brightColors, line: { color: "#ffffff", width: 1 } },
                    textinfo: "percent",
                    insidetextorientation: "radial"
                }];
            } else {
                data = [{ type: "bar", x: xData, y: yData, marker: { color: "#FF6B35" } }];
            }

            const layout = {
                title: {
                    text: visualManifest.title || "Visual Analysis",
                    font: { color: "#1a202c", family: "DM Sans, sans-serif", size: 13, weight: "bold" }
                },
                paper_bgcolor: "#ffffff",
                plot_bgcolor: "#ffffff",
                font: { color: "#2d3748" },
                margin: { t: 50, b: 50, l: 50, r: 50 },
                xaxis: {
                    gridcolor: "#edf2f7",
                    zerolinecolor: "#e2e8f0",
                    tickfont: { size: 10, color: "#4a5568" }
                },
                yaxis: {
                    gridcolor: "#edf2f7",
                    zerolinecolor: "#e2e8f0",
                    tickfont: { size: 10, color: "#4a5568" }
                }
            };

            return {
                lastError: null,
                retryCount: currentRetry,
                dataContext: {
                    ...state.dataContext,
                    plotlySpec: { data, layout },
                    lastStep: "generator-multichart-success"
                }
            };

        } catch (err) {
            console.error("❌ Declarative Plotly generation failed:", err.message);
            return {
                lastError: err.message,
                retryCount: currentRetry + 1,
                dataContext: {
                    ...state.dataContext,
                    vizError: err.message,
                    lastStep: "generator-multichart-failed"
                }
            };
        }
    }

    // 2. Skip if no visual manifest is provided by the Analyst
    if (!visualManifest) {
        if (io) io.emit("milestone", { node: "Generator", msg: "ℹ️ Data not visualizable. Skipping plot." });
        return {
            lastError: null,
            retryCount: currentRetry,
            dataContext: {
                ...state.dataContext,
                isVisual: false,
                lastStep: "generator-skipped"
            }
        };
    }

    // 3. Setup Memory Isolated Workspace
    const sessionUuid = crypto.randomUUID();
    const sessionDir = path.join(process.cwd(), "tmp", `session_${sessionUuid}`);
    
    if (io) io.emit("milestone", { node: "Generator", msg: `🎨 Creating isolated session workspace at tmp/session_${sessionUuid.substring(0, 8)}...` });

    try {
        fs.mkdirSync(sessionDir, { recursive: true });

        // Save data and config directly into the session folder
        const dataPath = path.join(sessionDir, "analysis_output.json");
        const configPath = path.join(sessionDir, "plot_config.json");
        const outputPath = path.join(sessionDir, "plot_output.png");

        fs.writeFileSync(dataPath, JSON.stringify(rawData));
        
        const configPayload = {
            ...visualManifest,
            data_path: dataPath
        };
        fs.writeFileSync(configPath, JSON.stringify(configPayload));

        // Determine active engine (Python or R)
        const vizEngine = (process.env.VIZ_ENGINE || "python").toLowerCase();
        let cmd = "";
        
        if (vizEngine === "r" || vizEngine === "rscript") {
            if (io) io.emit("milestone", { node: "Generator", msg: "🎨 Running R Cyberpunk Visualization Engine (ggplot2)..." });
            cmd = `Rscript universal_analyst.R --workspace "${sessionDir}"`;
        } else {
            if (io) io.emit("milestone", { node: "Generator", msg: "🎨 Running Python Cyberpunk Visualization Engine (Matplotlib/Seaborn)..." });
            cmd = `python3 universal_analyst.py --workspace "${sessionDir}"`;
        }

        // 4. Execute the Plot Engine CLI
        try {
            execSync(cmd, { stdio: "pipe", cwd: process.cwd() });

            // Check if output file exists in the isolated workspace
            if (!fs.existsSync(outputPath)) {
                throw new Error("CLI completed but isolated 'plot_output.png' was not generated.");
            }

            // Copy to final public assets path
            const publicPlotsDir = path.join(process.cwd(), "public", "temp_plots");
            if (!fs.existsSync(publicPlotsDir)) {
                fs.mkdirSync(publicPlotsDir, { recursive: true });
            }

            const finalPlotPath = path.join(publicPlotsDir, `plot_${sessionUuid.substring(0, 8)}.png`);
            fs.copyFileSync(outputPath, finalPlotPath);

            return {
                lastError: null,
                retryCount: currentRetry,
                dataContext: {
                    ...state.dataContext,
                    isVisual: true,
                    plotUrl: `/temp_plots/plot_${sessionUuid.substring(0, 8)}.png`,
                    lastError: null,
                    retryCount: currentRetry,
                    lastStep: "generator-success"
                }
            };

        } catch (execErr) {
            // Retrieve stdout/stderr from child process execution
            const errMsg = execErr.stderr ? execErr.stderr.toString() : execErr.message;
            console.error("❌ Visualization CLI Rendering Failed:", errMsg);

            if (io) io.emit("milestone", { node: "Generator", msg: `❌ CLI Error: ${errMsg.substring(0, 100)}...`, error: true });

            return {
                lastError: errMsg,
                retryCount: currentRetry + 1,
                dataContext: {
                    ...state.dataContext,
                    vizError: errMsg,
                    lastError: errMsg,
                    retryCount: currentRetry + 1,
                    lastStep: "generator-failed-retry"
                }
            };
        }

    } catch (err) {
        console.error("❌ Generator failed to establish session:", err.message);
        return {
            lastError: err.message,
            retryCount: currentRetry + 1,
            dataContext: {
                ...state.dataContext,
                lastError: err.message,
                retryCount: currentRetry + 1,
                lastStep: "generator-session-error"
            }
        };

    } finally {
        // 5. Concurrency Cleanup Hook: wipe out temporary session workspace
        try {
            if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }
        } catch (cleanupErr) {
            console.error("⚠️ Failed to clean up workspace session directory:", cleanupErr.message);
        }
    }
}
