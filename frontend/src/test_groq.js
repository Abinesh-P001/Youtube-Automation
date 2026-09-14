import { generateScriptPhase } from "./services/api.js";

async function testGroq() {
  try {
    const result = await generateScriptPhase({
      topic: "Artificial Intelligence",
      scriptModel: "Groq"
    });
    console.log("Result:", result);
  } catch (error) {
    console.error("Test Failed with Error:", error.message);
  }
}

testGroq();
