import fetch from "node-fetch";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { TTSProvider } from "./TTSProvider.js";

// Helper to validate audio using ffprobe
function validateAudioFile(audioPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(audioPath)) {
      return reject(new Error("Audio file was not created."));
    }
    const stats = fs.statSync(audioPath);
    if (stats.size === 0) {
      return reject(new Error("Audio file is empty (0 bytes)."));
    }

    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Audio file is invalid or not readable by FFmpeg: ${err.message}`));
      }
      if (!metadata || !metadata.format || !metadata.format.duration) {
        return reject(new Error("Audio file format is unrecognized or has no duration."));
      }
      const duration = parseFloat(metadata.format.duration);
      if (duration <= 0) {
        return reject(new Error("Audio file duration is 0."));
      }
      resolve(metadata);
    });
  });
}

export class KokoroProvider extends TTSProvider {
  async generate(text, outputPath) {
    const endpoint = process.env.KOKORO_API_ENDPOINT;
    const deepinfraToken = process.env.DEEPINFRA_API_KEY;

    if (!endpoint) {
      throw new Error("KOKORO_API_ENDPOINT is not configured in .env");
    }

    // Explicitly reject the obsolete Hugging Face inference endpoint
    if (endpoint.includes("api-inference.huggingface.co")) {
      throw new Error(
        "Hugging Face does NOT currently provide a managed serverless inference endpoint for hexgrad/Kokoro-82M. " +
        "Please update KOKORO_API_ENDPOINT in your .env to a supported hosted provider."
      );
    }
    
    // Explicitly reject localhost unless configured (we are defaulting to DeepInfra in .env now)
    if (endpoint.includes("127.0.0.1") || endpoint.includes("localhost")) {
        throw new Error(
            "Localhost Kokoro endpoint is not supported for this project. Please configure a real hosted provider."
        );
    }

    if (!deepinfraToken) {
        throw new Error("DEEPINFRA_API_KEY is not defined in environment variables. A valid API key is required.");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("Cannot generate voice over for empty text.");
    }

    console.log(`[KokoroProvider] Generating TTS for text (${text.length} chars) using ${endpoint}`);

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${deepinfraToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            text: text,
            voice: "af_bella" // default deepinfra kokoro voice
        }),
        timeout: 60000 // 60s timeout
      });
    } catch (err) {
      if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
        throw new Error(`Connection failed to ${endpoint} (${err.code}). DNS or Network error.`);
      }
      if (err.name === 'FetchError' && err.type === 'request-timeout') {
         throw new Error(`Request to ${endpoint} timed out.`);
      }
      throw err;
    }

    if (!response.ok) {
      let errorMsg = `API returned ${response.status} ${response.statusText}`;
      
      if (response.status === 401) errorMsg = "401 Unauthorized - Invalid or missing DeepInfra API key.";
      else if (response.status === 403) errorMsg = "403 Forbidden - Permission or provider access problem.";
      else if (response.status === 404) errorMsg = "404 Not Found - Model, provider, or endpoint unavailable.";
      else if (response.status === 429) errorMsg = "429 Too Many Requests - Quota or rate limit exceeded.";
      else if (response.status >= 500) errorMsg = `${response.status} Server Error - Provider issue.`;

      try {
        const errorJson = await response.json();
        if (errorJson.error) {
          errorMsg += ` Details: ${JSON.stringify(errorJson.error)}`;
        } else if (errorJson.detail) {
          errorMsg += ` Details: ${JSON.stringify(errorJson.detail)}`;
        }
      } catch (e) {
        // Ignore if not json
      }
      throw new Error(errorMsg);
    }

    // Wait for the audio bytes
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
    console.log(`[KokoroProvider] Audio saved to ${outputPath}`);
    
    // Validate the generated audio using ffprobe
    console.log(`[KokoroProvider] Validating generated audio...`);
    await validateAudioFile(outputPath);
    console.log(`[KokoroProvider] Audio validation successful.`);
    
    return outputPath;
  }
}
