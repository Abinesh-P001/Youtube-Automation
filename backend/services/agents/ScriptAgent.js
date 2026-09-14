import { z } from "zod";
import { getScriptModel } from "../providers/ScriptModelFactory.js";

const ScriptSchema = z.object({
  title: z.string().describe("The professional and engaging title of the YouTube video."),
  hook: z.string().describe("A catchy hook for the beginning of the video."),
  narration: z.string().describe("The complete, natural, and engaging narration of the entire video."),
  ending: z.string().describe("The ending narration of the video."),
  cta: z.string().describe("Call to action to like, subscribe, etc."),
  scenes: z.array(
    z.object({
      narration: z.string().describe("The portion of the narration specific to this scene."),
      duration: z.number().describe("The duration of the scene in seconds. (e.g., 5 or 10)"),
    })
  ).describe("Scene-by-scene breakdown of the narration."),
});

export async function generateScript(topic, modelName = "OpenAI", retryCount = 0) {
  console.log(`[ScriptAgent] Generating script using ${modelName} for topic: "${topic}" (Attempt ${retryCount + 1})`);
  
  const model = getScriptModel(modelName);
  
  let modelWithStructure;
  if (modelName === "Groq") {
    modelWithStructure = model.withStructuredOutput(ScriptSchema, { method: "jsonMode", name: "script" });
  } else {
    modelWithStructure = model.withStructuredOutput(ScriptSchema);
  }

  const prompt = `You are a professional YouTube scriptwriter. Create an engaging, factual, and natural script about the following topic.
Topic: "${topic}"

Requirements:
- Ensure the narration is natural, engaging, and flows well.
- Break down the narration into logical scenes.
- IMPORTANT: Generate exactly 5 to 8 scenes. Do NOT exceed 8 scenes.
- Each scene should be around 5 to 10 seconds long in terms of speaking time.
- Provide a strong hook, ending, and a CTA.
- The scene narrations combined should match the flow of the complete narration.
- Return ONLY valid JSON in the exact structure requested. Do NOT include markdown fences, comments, or trailing text. Ensure all strings and arrays are properly closed.`;

  try {
    let scriptResult;
    if (modelName === "Groq") {
      // Manual JSON generation and validation for Groq
      console.log("[Groq] Request started");
      console.log(`[Groq] API key configured: ${Boolean(process.env.GROQ_API_KEY)}`);
      console.log(`[Groq] Model: ${process.env.GROQ_MODEL || "qwen/qwen3.6-27b"}`);
      
      const rawPrompt = prompt + "\n\nCRITICAL: Respond ONLY with a valid JSON object matching the requested structure.";
      console.log("[Groq] Request sent");
      
      const rawResponse = await model.invoke(rawPrompt);
      console.log("[Groq] Response received");
      console.log("[Groq] Parsing response");
      
      const content = typeof rawResponse.content === "string" ? rawResponse.content : JSON.stringify(rawResponse.content);
      
      let parsedJson;
      try {
        let cleanContent = content.trim();
        // Extract strictly between the first '{' and the last '}'
        const firstBrace = cleanContent.indexOf('{');
        const lastBrace = cleanContent.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
          cleanContent = cleanContent.substring(firstBrace, lastBrace + 1);
        } else {
          throw new Error("No JSON object found in response");
        }
        
        parsedJson = JSON.parse(cleanContent);
      } catch (parseErr) {
        throw new Error("OUTPUT_PARSING_FAILURE: " + parseErr.message);
      }
      
      scriptResult = ScriptSchema.parse(parsedJson);
      console.log("[ScriptAgent] Script generated and parsed successfully via manual JSON mode.");
    } else {
      scriptResult = await modelWithStructure.invoke(prompt);
      console.log("[ScriptAgent] Script generated and parsed successfully.");
    }
    return scriptResult;
  } catch (error) {
    console.error(`[ScriptAgent] Error on attempt ${retryCount + 1}:`, error.message);
    
    // Handle parsing errors (truncation, bad json, etc)
    if (error.message.includes("OUTPUT_PARSING_FAILURE") || error.message.includes("SyntaxError") || error.message.includes("parse") || error instanceof z.ZodError) {
      if (retryCount < 1) {
        console.log(`[ScriptAgent] Retrying generation due to parsing failure...`);
        return await generateScript(topic, modelName, retryCount + 1);
      } else {
        throw new Error(`${modelName} returned an incomplete or malformed response. Please try Regenerate or choose a simpler topic.`);
      }
    }

    if (modelName === "OpenAI" && (error.message.includes("429") || error.message.includes("insufficient_quota") || error.message.includes("rate limit"))) {
      throw new Error("OpenAI limit reached. Please switch to Gemini.");
    }
    
    if (modelName === "Gemini") {
      const msg = error.message.toLowerCase();
      let safeReason = "Unknown error";
      
      if (msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") || msg.includes("exhausted")) {
        safeReason = "Quota exceeded or rate limit reached for Gemini.";
      } else if (msg.includes("404") || msg.includes("not found")) {
        safeReason = "Model or endpoint not found.";
      } else if (msg.includes("401") || msg.includes("403")) {
        safeReason = "Authentication or permission failed.";
      }
      
      console.error(`[Gemini] ERROR status: ${safeReason} | raw: ${error.message}`);
      throw new Error(`Gemini API error: ${safeReason} Please try another provider.`);
    }

    if (modelName === "Groq") {
      const msg = error.message.toLowerCase();
      let safeReason = "Unknown error";
      
      if (msg.includes("429") || msg.includes("rate limit") || msg.includes("tokens")) {
        safeReason = "Rate limit exceeded (try again later or use Gemini).";
      } else if (msg.includes("401") || msg.includes("403")) {
        safeReason = "Authentication/Permission failed.";
      } else if (msg.includes("400") || msg.includes("invalid")) {
        safeReason = "Invalid request/model parameters.";
      } else if (msg.includes("404")) {
        safeReason = "Model or endpoint not found.";
      } else if (msg.includes("50") || msg.includes("timeout") || msg.includes("network")) {
        safeReason = "Network or server error.";
      } else if (msg.includes("output_parsing_failure")) {
        safeReason = "Failed to parse script output.";
      }

      console.error(`[Groq] ERROR status: ${safeReason} | code: ${msg.match(/\d{3}/)?.[0] || 'N/A'}`);
      throw new Error(`Groq generation failed: ${safeReason}`);
    }
    
    throw error;
  }
}
