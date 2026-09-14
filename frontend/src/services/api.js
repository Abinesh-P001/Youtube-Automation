const API_BASE = "http://localhost:3001/api";

export async function generateScriptPhase({ topic, scriptModel }) {
  const response = await fetch(`${API_BASE}/video/generate-script`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, scriptModel }),
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || "Script generation failed.");
  }
  return data;
}

export async function updateScriptPhase({ jobId, script, scriptModel }) {
  const response = await fetch(`${API_BASE}/video/update-script/${jobId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script, scriptModel }),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to update script.");
  }
  return data;
}

export async function generateMediaPhase({ jobId, model }) {
  const response = await fetch(`${API_BASE}/video/generate-media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeJobId: jobId, model }),
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || "Media generation failed.");
  }
  return data;
}

export function createJobStream(jobId, onMessage) {
  const eventSource = new EventSource(`${API_BASE}/video/stream/${jobId}`);
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error("Failed to parse SSE message", e);
    }
  };

  eventSource.onerror = (err) => {
    console.error("SSE connection error", err);
    eventSource.close();
  };

  return eventSource;
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}
