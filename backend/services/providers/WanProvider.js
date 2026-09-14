import fetch from "node-fetch";

const WAN_API_BASE = "https://api.wan-video.com/v1"; // Placeholder if exact URL varies

export async function generateWanVideo(prompt, duration) {
  console.log(`[WanProvider] Generating video... Prompt: "${prompt.substring(0, 50)}..."`);
  
  if (!process.env.WAN_API_KEY) {
    throw new Error("WAN_API_KEY is not configured.");
  }

  // Submit job
  const submitRes = await fetch(`${WAN_API_BASE}/t2v/submit`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.WAN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, duration }),
  });

  if (!submitRes.ok) {
    throw new Error(`Wan API submission failed: ${submitRes.status} ${submitRes.statusText}`);
  }

  const { task_id } = await submitRes.json();

  // Poll for completion
  return pollWanTask(task_id);
}

async function pollWanTask(taskId) {
  const maxAttempts = 120;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const res = await fetch(`${WAN_API_BASE}/t2v/status/${taskId}`, {
      headers: { "Authorization": `Bearer ${process.env.WAN_API_KEY}` }
    });
    
    if (!res.ok) continue;

    const data = await res.json();
    if (data.status === "completed") {
      return data.video_url;
    }
    if (data.status === "failed") {
      throw new Error(`Wan API task failed: ${data.error}`);
    }
    console.log(`[WanProvider] Polling task ${taskId}... attempt ${attempt}/${maxAttempts}`);
  }
  throw new Error("Wan API generation timed out.");
}
