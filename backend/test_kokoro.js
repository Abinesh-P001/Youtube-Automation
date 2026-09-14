import "dotenv/config";
import { KokoroProvider } from "./services/tts/KokoroProvider.js";

async function test() {
  const provider = new KokoroProvider();
  try {
    await provider.generate("Testing the Kokoro TTS fallback logic.", "test_audio.mp3");
  } catch (err) {
    console.error("Test Caught Error:", err.message);
  }
}

test();
