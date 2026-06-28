import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// Fallback Provider Configurations
const PROVIDERS = {
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.1-8b-instant"
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_PALM_API_KEY || process.env.GOOGLE_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.5-flash"
  },
  ollama: {
    apiKey: "ollama",
    baseURL: process.env.LOCAL_AI_BASE_URL || "http://localhost:11434/v1",
    defaultModel: process.env.LOCAL_AI_MODEL || "llama3.1"
  }
};

// Node Preference Mapping Matrix (Mid-2026 standard models)
const NODE_PREFS = {
  discovery: { primary: "groq", model: "llama-3.3-70b-specdec", fallback: ["gemini", "ollama"] },
  planner: { primary: "gemini", model: "gemini-2.5-pro", fallback: ["groq", "ollama"] },
  analyst: { primary: "gemini", model: "gemini-2.5-flash", fallback: ["groq", "ollama"] },
  analyst_resolution: { primary: "groq", model: "llama-3.1-8b-instant", fallback: ["gemini", "ollama"] },
  analyst_intent: { primary: "groq", model: "llama-3.1-8b-instant", fallback: ["gemini", "ollama"] },
  analyst_slotfill: { primary: "groq", model: "llama-3.1-8b-instant", fallback: ["gemini", "ollama"] },
  summarizer: { primary: "gemini", model: "gemini-2.5-flash", fallback: ["groq", "ollama"] }
};

/**
 * chatCompletionWithFallback
 * Automatically executes LLM queries across a fallback cascade chain.
 */
async function chatCompletionWithFallback(nodeType, messages, options = {}) {
  const prefs = NODE_PREFS[nodeType] || { primary: "groq", model: "llama-3.1-8b-instant", fallback: ["ollama"] };
  const chain = [prefs.primary, ...prefs.fallback];

  let lastErr = null;
  for (const providerKey of chain) {
    const provider = PROVIDERS[providerKey];
    if (!provider || !provider.apiKey) {
      continue; // Skip if credentials are not configured
    }

    const client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
      timeout: options.timeout || 12000 // 12 seconds per-provider timeout before failover
    });

    let modelName = providerKey === prefs.primary ? prefs.model : provider.defaultModel;

    // Direct override to ensure high-reasoning fallback when using Gemini
    if (providerKey === "gemini" && nodeType === "planner") {
      modelName = "gemini-2.5-pro";
    }

    const payload = {
      messages,
      model: modelName,
      temperature: options.temperature !== undefined ? options.temperature : 0.1,
      max_tokens: options.max_tokens || 1500
    };

    // Apply JSON mode format where requested and supported
    if (options.response_format) {
      payload.response_format = options.response_format;
    }

    let retries = 0;
    const maxProviderRetries = 3;
    let success = false;
    let result = null;

    while (retries < maxProviderRetries && !success) {
      try {
        console.log(`🤖 [Router] Dispatching node '${nodeType}' to provider '${providerKey}' using model '${modelName}'${retries > 0 ? ` (Retry ${retries}/${maxProviderRetries - 1})` : ""}`);
        const chatCompletion = await client.chat.completions.create(payload);
        result = {
          content: chatCompletion.choices[0]?.message?.content || "",
          provider: providerKey,
          model: modelName
        };
        success = true;
      } catch (err) {
        const isRateLimit = err.status === 429 || err.message.includes("429") || err.message.toLowerCase().includes("rate limit");
        if (isRateLimit && retries < maxProviderRetries - 1) {
          const waitTime = (retries + 1) * 4000;
          console.warn(`⚠️ [Router] Provider '${providerKey}' rate limited (429). Retrying in ${waitTime/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
        } else {
          console.warn(`⚠️ [Router] Provider '${providerKey}' failed for node '${nodeType}': ${err.message}. Cascading to next fallback...`);
          lastErr = err;
          break;
        }
      }
    }

    if (success) {
      return result;
    }
  }

  throw new Error(`All LLM fallback providers failed for node '${nodeType}'. Last error: ${lastErr?.message}`);
}

/**
 * getAIModel
 * Returns an abstraction wrapper presenting generateContent for a specific node category.
 */
export async function getAIModel(nodeType = "analyst") {
  return {
    generateContent: async (prompt, systemPrompt = "", options = {}) => {
      const messages = [
        {
          role: "system",
          content: systemPrompt || "You are a helpful data analyst assistant."
        },
        {
          role: "user",
          content: typeof prompt === "string" ? prompt : JSON.stringify(prompt)
        }
      ];

      const result = await chatCompletionWithFallback(nodeType, messages, options);
      
      return {
        response: {
          text: () => result.content
        },
        provider: result.provider,
        model: result.model
      };
    }
  };
}
