import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { generateScript } from "./agents/ScriptAgent.js";
import { generateVisualPlan } from "./agents/VisualDirectorAgent.js";
import { generateVideoWithProvider } from "./providers/VideoProviderRouter.js";
import { KokoroProvider } from "./tts/KokoroProvider.js";
import { generateSubtitles } from "./SubtitleGenerator.js";
import { generateThumbnail } from "./ThumbnailGenerator.js";
import { composeVideo } from "./VideoComposer.js";

const TEMP_DIR = path.resolve(process.cwd(), "temp_outputs");

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

async function downloadVideo(url, outputPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download video from ${url}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  return outputPath;
}

export class WorkflowOrchestrator {
  constructor({ topic, videoModel, scriptModel, resumeJobId }, onProgress) {
    this.topic = topic;
    this.videoModel = videoModel || "Wan";
    this.scriptModel = scriptModel || "OpenAI";
    this.onProgress = onProgress || (() => {});
    
    this.jobId = resumeJobId || Date.now().toString();
    this.jobDir = path.join(TEMP_DIR, this.jobId);
    if (!fs.existsSync(this.jobDir)) {
      fs.mkdirSync(this.jobDir, { recursive: true });
    }
    this.statePath = path.join(this.jobDir, "state.json");
  }

  loadState() {
    if (fs.existsSync(this.statePath)) {
      const state = JSON.parse(fs.readFileSync(this.statePath, 'utf-8'));
      if (state.topic && !this.topic) this.topic = state.topic;
      return state;
    }
    return { script: null, visualPlan: null, topic: this.topic };
  }

  saveState(state) {
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }

  // Phase 1: Script and Visual Plan
  async generateScriptPhase() {
    try {
      let state = this.loadState();
      state.topic = this.topic;
      this.saveState(state);
      
      this.onProgress({ step: "Script", status: "in-progress", details: `Using ${this.scriptModel}` });
      const script = await generateScript(this.topic, this.scriptModel);
      state.script = script;
      this.saveState(state);
      this.onProgress({ step: "Script", status: "completed", data: script });

      this.onProgress({ step: "Scene Planning", status: "in-progress", details: `Using ${this.scriptModel}` });
      const visualPlan = await generateVisualPlan(script, this.scriptModel);
      state.visualPlan = visualPlan;
      this.saveState(state);
      this.onProgress({ step: "Scene Planning", status: "completed", data: visualPlan });

      return { jobId: this.jobId, script, visualPlan };
    } catch (error) {
      console.error("[WorkflowOrchestrator] Script Phase Failed:", error);
      this.onProgress({ step: "Error", status: "failed", error: error.message });
      throw error;
    }
  }

  // Phase 2: Media Generation
  async generateMediaPhase() {
    try {
      let state = this.loadState();
      let script = state.script;
      let visualPlan = state.visualPlan;

      if (!script || !visualPlan) {
        throw new Error("Cannot generate media without an approved script and visual plan.");
      }

      // Voice Generation
      const audioPath = path.join(this.jobDir, "narration.mp3");
      if (!fs.existsSync(audioPath)) {
        this.onProgress({ step: "Voice Generation", status: "in-progress" });
        const provider = new KokoroProvider();
        await provider.generate(script.narration, audioPath);
        this.onProgress({ step: "Voice Generation", status: "completed" });
      } else {
        this.onProgress({ step: "Voice Generation", status: "completed" });
      }

      // Subtitle Generation
      const subtitlePath = path.join(this.jobDir, "subtitles.srt");
      if (!fs.existsSync(subtitlePath)) {
        this.onProgress({ step: "Subtitle Generation", status: "in-progress" });
        await generateSubtitles(script.narration, audioPath, subtitlePath);
        this.onProgress({ step: "Subtitle Generation", status: "completed" });
      } else {
        this.onProgress({ step: "Subtitle Generation", status: "completed" });
      }

      // Thumbnail Generation
      const thumbnailPath = path.join(this.jobDir, "thumbnail.png");
      if (!fs.existsSync(thumbnailPath)) {
        this.onProgress({ step: "Thumbnail Generation", status: "in-progress" });
        const summary = visualPlan.scenes.length > 0 ? visualPlan.scenes[0].visualDescription : this.topic;
        await generateThumbnail(script.title, summary, thumbnailPath);
        this.onProgress({ step: "Thumbnail Generation", status: "completed", thumbnailPath });
      } else {
        this.onProgress({ step: "Thumbnail Generation", status: "completed", thumbnailPath });
      }

      // Video Generation
      this.onProgress({ step: "Video Generation", status: "in-progress", details: `Using ${this.videoModel}` });
      const videoPaths = [];
      for (let i = 0; i < visualPlan.scenes.length; i++) {
        const scenePath = path.join(this.jobDir, `scene_${i}.mp4`);
        if (!fs.existsSync(scenePath)) {
          const scene = visualPlan.scenes[i];
          this.onProgress({ step: "Video Generation", status: "in-progress", details: `Scene ${i + 1}/${visualPlan.scenes.length} (${this.videoModel})` });
          
          try {
             const { url } = await generateVideoWithProvider(scene.optimizedT2VPrompt, scene.duration, this.videoModel);
             await downloadVideo(url, scenePath);
          } catch (err) {
             throw new Error(`${this.videoModel} API limit/error. Please switch to ${this.videoModel === 'Wan' ? 'LTX' : 'Wan'}. (${err.message})`);
          }
        }
        videoPaths.push(scenePath);
      }
      this.onProgress({ step: "Video Generation", status: "completed" });

      // Composition
      this.onProgress({ step: "Composition", status: "in-progress" });
      const finalVideoPath = path.join(this.jobDir, "final_video.mp4");
      await composeVideo(videoPaths, audioPath, subtitlePath, finalVideoPath);
      this.onProgress({ step: "Composition", status: "completed" });

      this.onProgress({ step: "Complete", status: "completed", finalVideoPath, thumbnailPath });
      
      return {
        jobId: this.jobId,
        script,
        visualPlan,
        finalVideoPath,
        thumbnailPath
      };

    } catch (error) {
      console.error("[WorkflowOrchestrator] Media Phase Failed:", error);
      this.onProgress({ step: "Error", status: "failed", error: error.message });
      throw error;
    }
  }

  // Run everything (legacy fallback, or if approval isn't needed)
  async run() {
    await this.generateScriptPhase();
    return await this.generateMediaPhase();
  }
}
