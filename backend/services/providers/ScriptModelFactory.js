import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";

export function getScriptModel(modelName) {
  if (modelName === "Gemini") {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    return new ChatGoogleGenerativeAI({
      model: process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
      temperature: 0.7,
      maxOutputTokens: 8192,
      apiKey: process.env.GEMINI_API_KEY,
      thinkingConfig: { thinkingLevel: "low" }
    });
  } else if (modelName === "Groq") {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not configured.");
    }
    return new ChatGroq({
      model: process.env.GROQ_MODEL || "qwen/qwen3.6-27b",
      temperature: 0.7,
      apiKey: process.env.GROQ_API_KEY,
      maxTokens: 950,
      modelKwargs: {
        reasoning_format: "hidden",
        response_format: { type: "json_object" }
      }
    });
  } else {
    // Default to OpenAI
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }
    return new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.7,
    });
  }
}
