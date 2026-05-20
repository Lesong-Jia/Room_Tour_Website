import crypto from "node:crypto";
import { getSupabaseClient } from "./supabaseService.js";

const DEFAULT_FLOW_STEP = "pre_experiment_questionnaire";

export async function startExperimentSession({
  currentFlowStep = DEFAULT_FLOW_STEP,
  conditionId = null,
  userAgent = ""
} = {}) {
  const supabase = getSupabaseClient();
  const participantCode = createParticipantCode();

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .insert({
      participant_code: participantCode,
      condition_id: conditionId
    })
    .select("id, participant_code, condition_id, created_at")
    .single();

  if (participantError) {
    throw toServiceError(participantError, "Could not create participant.");
  }

  const { data: session, error: sessionError } = await supabase
    .from("experiment_sessions")
    .insert({
      participant_id: participant.id,
      current_flow_step: currentFlowStep,
      status: "in_progress",
      user_agent: userAgent
    })
    .select("id, current_flow_step, status, started_at, last_seen_at")
    .single();

  if (sessionError) {
    throw toServiceError(sessionError, "Could not create experiment session.");
  }

  return formatIdentity({ participant, session });
}

export async function resumeExperimentSession({ participantId, sessionId }) {
  if (!participantId || !sessionId) {
    const error = new Error("participantId and sessionId are required.");
    error.status = 400;
    throw error;
  }

  const supabase = getSupabaseClient();

  const { data: session, error: sessionError } = await supabase
    .from("experiment_sessions")
    .update({
      last_seen_at: new Date().toISOString()
    })
    .eq("id", sessionId)
    .eq("participant_id", participantId)
    .select("id, participant_id, current_flow_step, status, started_at, last_seen_at")
    .single();

  if (sessionError) {
    throw toServiceError(sessionError, "Could not resume experiment session.");
  }

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, participant_code, condition_id, created_at")
    .eq("id", session.participant_id)
    .single();

  if (participantError) {
    throw toServiceError(participantError, "Could not load participant.");
  }

  return formatIdentity({ participant, session });
}

export async function updateSessionFlowStep({
  participantId,
  sessionId,
  currentFlowStep
}) {
  if (!participantId || !sessionId || !currentFlowStep) {
    const error = new Error(
      "participantId, sessionId, and currentFlowStep are required."
    );
    error.status = 400;
    throw error;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("experiment_sessions")
    .update({
      current_flow_step: currentFlowStep,
      last_seen_at: new Date().toISOString()
    })
    .eq("id", sessionId)
    .eq("participant_id", participantId);

  if (error) {
    throw toServiceError(error, "Could not update experiment session.");
  }
}

function createParticipantCode() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();

  return `P-${timestamp}-${suffix}`;
}

function formatIdentity({ participant, session }) {
  return {
    participantId: participant.id,
    participantCode: participant.participant_code,
    conditionId: participant.condition_id,
    sessionId: session.id,
    currentFlowStep: session.current_flow_step,
    sessionStatus: session.status,
    startedAt: session.started_at,
    lastSeenAt: session.last_seen_at
  };
}

function toServiceError(sourceError, fallbackMessage) {
  const error = new Error(getFriendlySupabaseMessage(sourceError, fallbackMessage));
  error.status = 500;
  error.cause = sourceError;
  return error;
}

function getFriendlySupabaseMessage(sourceError, fallbackMessage) {
  if (sourceError.code === "PGRST205") {
    return `${sourceError.message}. Run docs/supabase_schema.sql in the Supabase SQL Editor, then retry.`;
  }

  return sourceError.message || fallbackMessage;
}
