const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://127.0.0.1:3001" : "");

export async function postJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await getErrorMessage(response);
    throw new Error(message || `API request failed: ${response.status}`);
  }

  return response.json();
}

export async function startExperimentSession(payload) {
  return postJson("/api/experiment/session/start", payload);
}

export async function resumeExperimentSession(payload) {
  return postJson("/api/experiment/session/resume", payload);
}

export async function uploadSpeechTurn(formData) {
  const response = await fetch(`${API_BASE_URL}/api/speech/turn`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const message = await getErrorMessage(response);
    throw new Error(message || `Speech upload failed: ${response.status}`);
  }

  return response.json();
}

export async function resetRoomTourProgress(payload) {
  return postJson("/api/room-tour/progress/reset", payload);
}

export async function submitRoomTourCompletion(payload) {
  return postJson("/api/room-tour/complete", payload);
}

export async function submitTaskPhaseTrialResult(payload) {
  return postJson("/api/task-phase/trial-result", payload);
}

export async function loadTaskPhaseClarifications(payload) {
  return postJson("/api/task-phase/clarifications/status", payload);
}

export async function markTaskPhaseClarification(payload) {
  return postJson("/api/task-phase/clarifications/mark", payload);
}

async function getErrorMessage(response) {
  try {
    const payload = await response.json();
    return payload.error?.message;
  } catch {
    return "";
  }
}
