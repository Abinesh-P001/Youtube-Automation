import { z } from "zod";
import { getScriptModel } from "../providers/ScriptModelFactory.js";

const SceneVisualPlanSchema = z.object({
  narration: z.string().describe("The original narration for this scene."),
  visualDescription: z.string().describe("Detailed description of what is happening visually."),
  mainSubject: z.string().describe("The main subject of the scene (e.g., A person, an animal, an object)."),
  environment: z.string().describe("The setting or environment (e.g., A dark room, a sunny beach, abstract background)."),
  action: z.string().describe("The specific action happening in the scene."),
  cameraAngle: z.string().describe("The angle of the camera (e.g., wide shot, close up, low angle)."),
  cameraMovement: z.string().describe("The movement of the camera (e.g., pan left, dolly in, static)."),
  lighting: z.string().describe("The lighting of the scene (e.g., cinematic lighting, bright sunlight, neon lights)."),
  visualStyle: z.string().describe("The overarching visual style (e.g., photorealistic, 3d animation, cinematic)."),
  duration: z.number().describe("The duration of the scene in seconds."),
  optimizedT2VPrompt: z.string().describe("A highly optimized prompt for a Text-to-Video AI model (like Wan or LTX) combining all the above elements."),
  negativePrompt: z.string().describe("Negative prompt specifying what should NOT be in the video (e.g., deformed, ugly, bad quality, text)."),
});

const VisualDirectorSchema = z.object({
  scenes: z.array(SceneVisualPlanSchema).describe("The visual plan for each scene in the video."),
});

export async function generateVisualPlan(script, modelName = "OpenAI", retryCount = 0) {
  console.log(`[VisualDirectorAgent] Generating visual plan using ${modelName} (Attempt ${retryCount + 1})...`);

  const model = getScriptModel(modelName);
  const modelWithStructure = model.withStructuredOutput(VisualDirectorSchema);

  const prompt = `You are an expert Visual Director for YouTube videos. 
Your job is to take the provided script and create a detailed, highly specific visual plan for each scene. 
The visuals MUST directly match the narration. Avoid unrelated or repetitive scenes. 
Ensure the optimizedT2VPrompt is highly descriptive and tailored for advanced AI text-to-video models.
Return ONLY valid JSON in the exact structure requested. Do NOT include markdown fences, comments, or trailing text. Ensure all strings and arrays are properly closed.

Script Title: ${script.title}
Hook: ${script.hook}
Complete Narration: ${script.narration}

Scenes to plan:
${script.scenes.map((s, i) => `Scene ${i + 1}:\nNarration: ${s.narration}\nDuration: ${s.duration}s\n`).join("\n")}
`;

  try {
    const visualResult = await modelWithStructure.invoke(prompt);
    console.log("[VisualDirectorAgent] Visual plan generated and parsed successfully.");
    return visualResult;
  } catch (error) {
    console.error(`[VisualDirectorAgent] Error on attempt ${retryCount + 1}:`, error.message);
    
    // Handle parsing errors (truncation, bad json, etc)
    if (error.message.includes("OUTPUT_PARSING_FAILURE") || error.message.includes("SyntaxError") || error.message.includes("parse")) {
      if (retryCount < 1) {
        console.log(`[VisualDirectorAgent] Retrying generation due to parsing failure...`);
        return await generateVisualPlan(script, modelName, retryCount + 1);
      } else {
        throw new Error(`${modelName} returned an incomplete or malformed response. Please try Regenerate or simplify your script edits.`);
      }
    }

    if (modelName === "OpenAI" && (error.message.includes("429") || error.message.includes("insufficient_quota") || error.message.includes("rate limit"))) {
      throw new Error("OpenAI limit reached. Please switch to Gemini.");
    }
    
    if (modelName === "Gemini") {
      const msg = error.message.toLowerCase();
      if (msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") || msg.includes("403") || msg.includes("401") || msg.includes("404") || msg.includes("not found")) {
        throw new Error("Gemini API error (Limit/Quota/Config). Please switch to OpenAI.");
      }
    }
    
    throw error;
  }
}
