import fetch from "node-fetch";

const LTX_API_BASE = "https://api.ltx-video.com/v1"; // Placeholder

export async function generateLTXVideo(prompt, duration) {
  console.log(`[LTXProvider] Generating video... Prompt: "${prompt.substring(0, 50)}..."`);
  
  if (!process.env.LTX_API_KEY) {
    throw new Error("LTX_API_KEY is not configured.");
  }

  // Submit job
  const submitRes = await fetch(`${LTX_API_BASE}/t2v/submit`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.LTX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, duration }),
  });

  if (!submitRes.ok) {
    throw new Error(`LTX API submission failed: ${submitRes.status} ${submitRes.statusText}`);
  }

  const { task_id } = await submitRes.json();

  // Poll for completion
  return pollLTXTask(task_id);
}

async function pollLTXTask(taskId) {
  const maxAttempts = 120;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const res = await fetch(`${LTX_API_BASE}/t2v/status/${taskId}`, {
      headers: { "Authorization": `Bearer ${process.env.LTX_API_KEY}` }
    });
    
    if (!res.ok) continue;

    const data = await res.json();
    if (data.status === "completed") {
      return data.video_url;
    }
    if (data.status === "failed") {
      throw new Error(`LTX API task failed: ${data.error}`);
    }
    console.log(`[LTXProvider] Polling task ${taskId}... attempt ${attempt}/${maxAttempts}`);
  }
  throw new Error("LTX API generation timed out.");
}
