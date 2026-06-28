import { getSchema } from "../tools/schema.js";

/**
 * 🔍 DISCOVERY NODE
 * 
 * This node is the "Eyes" of the agent. It connects to the database,
 * figures out what collections exist, and what the fields are named.
 * This information is saved to 'dataContext' so that the LLM (and R)
 * know exactly what columns names to use.
 */
export async function discoveryNode(state) {
    const io = state.dataContext.io;
    if (io) io.emit("milestone", { node: "Discovery", msg: "🔍 Initiating Automated Schema Discovery..." });
    
    console.log("🔍 Node: Schema Discovery...");
    
    try {
        const schema = await getSchema();
        if (io) io.emit("milestone", { node: "Discovery", msg: "✅ Schema Map synthesized and ready for analysis." });
        
        return {
            dataContext: {
                schema: schema,
                lastStep: "discovery"
            }
        };
    } catch (error) {
        console.error("❌ Discovery Failed:", error);
        if (io) io.emit("milestone", { node: "Discovery", msg: `❌ Discovery Error: ${error.message}`, error: true });
        return {
            dataContext: {
                error: `Discovery failed: ${error.message}`,
                lastStep: "discovery-failed"
            }
        };
    }
}
