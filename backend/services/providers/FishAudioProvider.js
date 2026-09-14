import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const FISH_AUDIO_API_URL = "https://api.fish.audio/v1/tts";

export async function generateVoiceOver(text, outputPath) {
  console.log(`[FishAudioProvider] Generating voice for text: "${text.substring(0, 30)}..."`);
  
  if (!process.env.FISH_AUDIO_API_KEY) {
    throw new Error("FISH_AUDIO_API_KEY is not configured.");
  }

  const response = await fetch(FISH_AUDIO_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.FISH_AUDIO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      // You can specify a reference_id or model if needed. 
      // Default behavior generates standard TTS audio.
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Fish Audio API failed: ${response.status} ${errorBody}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFileSync(outputPath, buffer);
  console.log(`[FishAudioProvider] Audio saved to ${outputPath}`);
  return outputPath;
}
