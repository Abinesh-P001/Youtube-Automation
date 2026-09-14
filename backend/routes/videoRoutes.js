import { Router } from "express";
import path from "path";
import fs from "fs";
import { WorkflowOrchestrator } from "../services/WorkflowOrchestrator.js";
import { generateVisualPlan } from "../services/agents/VisualDirectorAgent.js";
import { KokoroProvider } from "../services/tts/KokoroProvider.js";

const router = Router();
const activeJobs = new Map();
const TEMP_DIR = path.resolve(process.cwd(), "temp_outputs");

// Test TTS endpoint
router.post("/test-tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: "Text is required." });
    }

    const provider = new KokoroProvider();
    const testOutputPath = path.join(TEMP_DIR, `test_tts_${Date.now()}.wav`);
    
    const audioPath = await provider.generate(text, testOutputPath);
    
    res.json({ success: true, audioPath, message: "TTS generated and validated successfully." });
  } catch (error) {
    console.error("[TTS Test Route] Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

function setupOrchestrator(req, res, allowResume) {
  const { topic, model, scriptModel, resumeJobId } = req.body;
  if (!allowResume) {
    if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
      throw new Error("Topic is required and must be at least 3 characters.");
    }
  }

  const orchestrator = new WorkflowOrchestrator({ 
    topic: topic ? topic.trim() : undefined, 
    videoModel: model, 
    scriptModel, 
    resumeJobId: allowResume ? resumeJobId : undefined 
  }, (progressData) => {
    // Update job state
    const jobState = activeJobs.get(orchestrator.jobId) || { events: [] };
    jobState.events.push(progressData);
    activeJobs.set(orchestrator.jobId, jobState);

    // Send to any SSE clients
    if (jobState.clients) {
      jobState.clients.forEach(client => {
        client.write(`data: ${JSON.stringify(progressData)}\n\n`);
      });
    }
  });

  const jobId = orchestrator.jobId;
  if (!activeJobs.has(jobId)) {
    activeJobs.set(jobId, { events: [], clients: [] });
  }

  return orchestrator;
}

/**
 * POST /api/video/generate-script
 * Phase 1: Generates the script and visual plan, then pauses.
 */
router.post("/generate-script", async (req, res) => {
  try {
    const orchestrator = setupOrchestrator(req, res, false);
    // We execute it in the background so SSE stream can pick it up
    orchestrator.generateScriptPhase().catch(err => console.error("Script Phase Failed:", err));
    return res.json({ success: true, jobId: orchestrator.jobId });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/video/update-script/:jobId
 * Save manual user edits to the script and regenerate visual plan if necessary.
 */
router.put("/update-script/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { script, scriptModel } = req.body;
  
  if (!script) {
    return res.status(400).json({ success: false, error: "Script is required." });
  }

  try {
    const statePath = path.resolve(process.cwd(), "temp_outputs", jobId, "state.json");
    if (!fs.existsSync(statePath)) {
      return res.status(404).json({ success: false, error: "Job not found." });
    }

    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    state.script = script;
    
    // Regenerate visual plan based on updated script immediately
    const visualPlan = await generateVisualPlan(script, scriptModel || "OpenAI");
    state.visualPlan = visualPlan;
    
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    // Also send an SSE event so the frontend knows the plan was updated
    const jobState = activeJobs.get(jobId);
    if (jobState && jobState.clients) {
       const event = { step: "Scene Planning", status: "completed", data: visualPlan };
       jobState.events.push(event);
       jobState.clients.forEach(client => client.write(`data: ${JSON.stringify(event)}\n\n`));
    }

    return res.json({ success: true, script, visualPlan });
  } catch (err) {
    console.error("[API] Failed to update script:", err.message);
    // Check if it's an OpenAI limit error
    if (err.message.includes("OpenAI limit reached")) {
      return res.status(429).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: "Failed to update script." });
  }
});

/**
 * POST /api/video/generate-media
 * Phase 2: Generates video, audio, and composes final output using the approved script.
 */
router.post("/generate-media", async (req, res) => {
  try {
    const orchestrator = setupOrchestrator(req, res, true);
    if (!req.body.resumeJobId) {
      return res.status(400).json({ success: false, error: "resumeJobId is required to start media generation." });
    }
    orchestrator.generateMediaPhase().catch(err => console.error("Media Phase Failed:", err));
    return res.json({ success: true, jobId: orchestrator.jobId });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/video/stream/:jobId
 * SSE endpoint for real-time progress updates.
 */
router.get("/stream/:jobId", (req, res) => {
  const { jobId } = req.params;
  const jobState = activeJobs.get(jobId);

  if (!jobState) {
    return res.status(404).json({ success: false, error: "Job not found." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send historical events
  jobState.events.forEach(event => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  // Register client
  jobState.clients.push(res);

  req.on("close", () => {
    jobState.clients = jobState.clients.filter(client => client !== res);
  });
});

/**
 * GET /api/video/download/:jobId/:type
 */
router.get("/download/:jobId/:type", (req, res) => {
  const { jobId, type } = req.params;
  const fileName = type === "thumbnail" ? "thumbnail.png" : "final_video.mp4";
  const filePath = path.resolve(process.cwd(), "temp_outputs", jobId, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: "File not found or generation incomplete." });
  }

  res.download(filePath, fileName);
});

export default router;
