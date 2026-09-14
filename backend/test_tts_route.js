import fetch from "node-fetch";

async function runTest() {
  try {
    console.log("Sending POST to http://localhost:3001/api/tts/test-tts ...");
    const response = await fetch("http://localhost:3001/api/tts/test-tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: "This is a real Kokoro text to speech test."
      })
    });
    const result = await response.json();
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Test execution failed:", error);
  }
}

runTest();
