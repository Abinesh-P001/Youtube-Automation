/**
 * Kling AI Video Generation Service
 * Handles communication with the Kling API
 */

import crypto from 'crypto';

const KLING_API_BASE = "https://api.klingai.com";
const MAX_POLL_ATTEMPTS = 120;   // 10 minutes max
const POLL_INTERVAL_MS  = 5000;  // 5 seconds
const POLL_JITTER_MS    = 1000;

export const MODELS = {
  "kling-v1": { label: "Kling V1 Standard", defaultRes: "16:9" },
};

function sleep(ms, jitter = 0) {
  const delay = ms + Math.random() * jitter;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Generate JWT token if KLING_API_SECRET is present, otherwise return Bearer token.
 */
function getAuthHeader() {
  const apiKey = process.env.KLING_API_KEY;
  const apiSecret = process.env.KLING_API_SECRET;

  if (!apiKey) {
    throw new Error("KLING_API_KEY is not configured on the server.");
  }

  if (apiSecret) {
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
      iss: apiKey,
      exp: Math.floor(Date.now() / 1000) + 1800,
      nbf: Math.floor(Date.now() / 1000) - 5
    };

    const base64UrlEncode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signature = crypto.createHmac('sha256', apiSecret)
      .update(`${base64UrlEncode(header)}.${base64UrlEncode(payload)}`)
      .digest('base64url');
      
    const token = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.${signature}`;
    return `Bearer ${token}`;
  } else {
    return `Bearer ${apiKey}`;
  }
}

async function parseApiError(response, body) {
  const msg = body?.message || body?.error?.message || JSON.stringify(body);
  
  if (response.status === 401 || (body && body.code === 1001)) return "Invalid API key or authentication error.";
  if (response.status === 402 || (body && body.code === 1004)) return "Insufficient credits. Please top up your Kling account.";
  if (response.status === 429) return "Rate limit exceeded. Too many concurrent requests.";
  if (response.status >= 500) return `Kling server error: ${msg}`;
  
  return `Kling API error: ${msg}`;
}

export async function submitTextToVideo({ prompt, duration, aspectRatio }) {
  const authHeader = getAuthHeader();
  
  const payload = {
    prompt,
    model_name: "kling-v1",
    aspect_ratio: aspectRatio || "16:9",
  };

  if (duration && [5, 10].includes(Number(duration))) {
    payload.duration = Number(duration);
  } else {
    payload.duration = 5; // Default for Kling
  }

  const response = await fetch(`${KLING_API_BASE}/v1/videos/text2video`, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.code !== 0) {
    throw new Error(await parseApiError(response, data));
  }

  return { id: data.data.task_id, created_at: new Date().toISOString() };
}

export async function pollJobStatus(taskId, onProgress) {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS, POLL_JITTER_MS);

    const response = await fetch(`${KLING_API_BASE}/v1/videos/text2video/${taskId}`, {
      method: "GET",
      headers: { "Authorization": getAuthHeader() },
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json().catch(() => ({}));
    
    if (!response.ok || data.code !== 0) {
      if (response.status >= 500) {
        console.warn(`Poll attempt ${attempt}: received ${response.status}, retrying…`);
        continue;
      }
      throw new Error(await parseApiError(response, data));
    }

    const taskStatus = data.data.task_status;
    const taskResult = data.data.task_result;

    if (onProgress) {
      onProgress({ attempt, maxAttempts: MAX_POLL_ATTEMPTS, status: taskStatus });
    }

    console.log(`[Kling] Poll #${attempt} — task ${taskId}: ${taskStatus}`);

    if (taskStatus === "succeed" || taskStatus === "completed") {
      const videoUrls = taskResult?.videos || [];
      const videoUrl = videoUrls[0]?.url || videoUrls[0];
      if (!videoUrl) {
         throw new Error("Generation completed but no video URL returned.");
      }
      return { status: "completed", result: { video_url: videoUrl } };
    }

    if (taskStatus === "failed") {
      throw new Error(`Generation failed: ${data.data.task_status_msg || "Unknown error"}`);
    }
  }

  throw new Error("Video generation timed out after 10 minutes.");
}

export async function generateVideo(params, onProgress) {
  console.log("[Kling] Submitting text-to-video job…", { prompt: params.prompt?.slice(0, 80) });
  
  const job = await submitTextToVideo(params);
  console.log("[Kling] Task submitted:", job.id);
  
  const result = await pollJobStatus(job.id, onProgress);

  return {
    jobId: job.id,
    videoUrl: result.result.video_url,
    createdAt: job.created_at,
    completedAt: new Date().toISOString(),
    status: "completed",
  };
}
