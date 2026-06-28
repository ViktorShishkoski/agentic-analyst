import { analystNode } from "./analyst.js";
import { generatorNode } from "./generator.js";

/**
 * 🚀 PARALLEL RUNNER SERVICE
 * Manages concurrent goal execution branches.
 * Implements isolated per-branch retries and error containment.
 */
export async function parallelRunnerNode(state) {
  const io = state.dataContext.io;
  const goals = state.dataContext.goals || [];

  if (goals.length === 0) {
    return {
      dataContext: {
        ...state.dataContext,
        results: [],
        lastStep: "parallel-runner-empty"
      }
    };
  }

  if (io) io.emit("milestone", { node: "Runner", msg: `🚀 Spawning ${goals.length} parallel analysis pipelines...` });

  // 1. Map over goals and execute each branch concurrently
  const executionPromises = goals.map(async (goal, index) => {
    let retryCount = 0;
    const maxRetries = 2;
    let lastError = null;
    let rawData = [];
    let queryPlan = null;
    let chartSpec = null;

    // Isolate branch variables using a localized context
    const localContext = {
      ...state.dataContext,
      goal: goal,
      conceptualQuery: goal.intent // Target intent for this branch
    };

    // Branch Retry Loop
    while (retryCount <= maxRetries) {
      try {
        // Step A: Analyst Phase (Generates MongoDB pipeline & executes it)
        const analystState = await analystNode({
          dataContext: localContext,
          lastError: lastError,
          retryCount: retryCount
        });

        // Check if Analyst returned an error
        if (analystState.dataContext.mongoError) {
          throw new Error(`[Analyst] ${analystState.dataContext.mongoError}`);
        }

        rawData = analystState.dataContext.rawData || [];
        queryPlan = {
          collection: analystState.dataContext.lastCollection,
          visualManifest: analystState.dataContext.visualManifest,
          normalizedEntities: analystState.dataContext.normalizedEntities
        };

        // Step B: Generator Phase (Generates Plotly Spec)
        const generatorState = await generatorNode({
          dataContext: {
            ...localContext,
            rawData: rawData,
            visualManifest: queryPlan.visualManifest
          },
          retryCount: retryCount
        });

        // Check if Generator returned an error
        if (generatorState.dataContext.vizError || generatorState.lastError) {
          throw new Error(`[Generator] ${generatorState.dataContext.vizError || generatorState.lastError}`);
        }

        chartSpec = generatorState.dataContext.plotlySpec || generatorState.dataContext.chartSpec;
        break; // Successfully completed branch

      } catch (err) {
        console.warn(`⚠️ Goal '${goal.id}' failed (Attempt ${retryCount + 1}/${maxRetries + 1}): ${err.message}`);
        lastError = err.message;
        retryCount++;
      }
    }

    // contained fail-safe placeholder return
    if (!chartSpec) {
      console.error(`🛑 Goal '${goal.id}' failed completely after all retries.`);
      if (io) io.emit("milestone", { node: "Runner", msg: `⚠️ Goal ${index + 1} failed: ${lastError}`, error: true });
      return {
        id: goal.id,
        title: goal.title || "Failed Visualization",
        error: lastError || "Failed to generate visual report.",
        query: goal.intent
      };
    }

    if (io) io.emit("milestone", { node: "Runner", msg: `📈 Progress: Chart ${index + 1} of ${goals.length} ready.` });

    return {
      id: goal.id,
      title: goal.title || "Visual Analysis",
      query: goal.intent,
      plotlySpec: chartSpec,
      rawData: rawData,
      queryPlan: queryPlan
    };
  });

  // Wait for all branches to resolve (containing any branch failures)
  const results = await Promise.all(executionPromises);

  return {
    dataContext: {
      ...state.dataContext,
      results: results,
      lastStep: "parallel-runner-complete"
    }
  };
}
