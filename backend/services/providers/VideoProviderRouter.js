import { generateWanVideo } from "./WanProvider.js";
import { generateLTXVideo } from "./LTXProvider.js";

export async function generateVideoWithProvider(prompt, duration, providerModel) {
  if (providerModel === "Wan") {
    console.log("[VideoProvider] Generating via Wan...");
    const videoUrl = await generateWanVideo(prompt, duration);
    return { url: videoUrl, provider: "Wan" };
  } else if (providerModel === "LTX") {
    console.log("[VideoProvider] Generating via LTX...");
    const videoUrl = await generateLTXVideo(prompt, duration);
    return { url: videoUrl, provider: "LTX" };
  } else {
    throw new Error(`Unknown video provider model: ${providerModel}`);
  }
}
