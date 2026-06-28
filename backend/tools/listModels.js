import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GOOGLE_PALM_API_KEY;

async function listModels() {
    if (!API_KEY) {
        console.error("❌ GOOGLE_PALM_API_KEY is missing from .env");
        return;
    }

    try {
        console.log("🔍 Fetching available models for your API key via REST API...");
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
        );
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        console.log("\n✅ Supported Models:");
        data.models.forEach(m => console.log(`- ${m.name} (${m.displayName})`));
        
    } catch (error) {
        console.error("❌ Failed to list models:", error.message);
        console.log("\n💡 TIP: Check if your billing account is linked in Google AI Studio.");
    }
}

listModels();
