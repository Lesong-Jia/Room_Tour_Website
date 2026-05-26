import crypto from "node:crypto";
import { getSupabaseClient } from "./supabaseService.js";

const DEFAULT_FLOW_STEP = "pre_experiment_questionnaire";

export async function startExperimentSession({
  currentFlowStep = DEFAULT_FLOW_STEP,
  userAgent = ""
} = {}) {
  const supabase = getSupabaseClient();
  const assignedCondition = await assignExperimentConditions(supabase);
  const participantCode = createParticipantCode();

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .insert({
      participant_code: participantCode,
      condition_id: assignedCondition.conditionId,
      condition_assignment_index: assignedCondition.assignmentIndex,
      room_tour_condition: assignedCondition.roomTourCondition,
      task_response_condition: assignedCondition.taskResponseCondition
    })
    .select("id, participant_code, condition_id, condition_assignment_index, room_tour_condition, task_response_condition, created_at")
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
      condition_assignment_index: assignedCondition.assignmentIndex,
      room_tour_condition: assignedCondition.roomTourCondition,
      task_response_condition: assignedCondition.taskResponseCondition,
      user_agent: userAgent
    })
    .select("id, current_flow_step, status, condition_assignment_index, room_tour_condition, task_response_condition, started_at, last_seen_at")
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
    .select("id, participant_id, current_flow_step, status, condition_assignment_index, room_tour_condition, task_response_condition, started_at, last_seen_at")
    .single();

  if (sessionError) {
    throw toServiceError(sessionError, "Could not resume experiment session.");
  }

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, participant_code, condition_id, condition_assignment_index, room_tour_condition, task_response_condition, created_at")
    .eq("id", session.participant_id)
    .single();

  if (participantError) {
    throw toServiceError(participantError, "Could not load participant.");
  }

  if (
    !participant.room_tour_condition ||
    !participant.task_response_condition ||
    !session.room_tour_condition ||
    !session.task_response_condition
  ) {
    const assignedCondition = await assignExperimentConditions(supabase);

    const { data: updatedParticipant, error: participantUpdateError } = await supabase
      .from("participants")
      .update({
        condition_id: assignedCondition.conditionId,
        condition_assignment_index: assignedCondition.assignmentIndex,
        room_tour_condition: assignedCondition.roomTourCondition,
        task_response_condition: assignedCondition.taskResponseCondition
      })
      .eq("id", participant.id)
      .select("id, participant_code, condition_id, condition_assignment_index, room_tour_condition, task_response_condition, created_at")
      .single();

    if (participantUpdateError) {
      throw toServiceError(participantUpdateError, "Could not update participant condition.");
    }

    const { data: updatedSession, error: sessionUpdateError } = await supabase
      .from("experiment_sessions")
      .update({
        condition_assignment_index: assignedCondition.assignmentIndex,
        room_tour_condition: assignedCondition.roomTourCondition,
        task_response_condition: assignedCondition.taskResponseCondition,
        last_seen_at: new Date().toISOString()
      })
      .eq("id", sessionId)
      .eq("participant_id", participantId)
      .select("id, participant_id, current_flow_step, status, condition_assignment_index, room_tour_condition, task_response_condition, started_at, last_seen_at")
      .single();

    if (sessionUpdateError) {
      throw toServiceError(sessionUpdateError, "Could not update session condition.");
    }

    return formatIdentity({
      participant: updatedParticipant,
      session: updatedSession
    });
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
  const now = new Date().toISOString();
  const isCompletionStep = currentFlowStep === "completion";
  const sessionUpdate = {
    current_flow_step: currentFlowStep,
    last_seen_at: now
  };

  if (isCompletionStep) {
    sessionUpdate.status = "completed";
    sessionUpdate.completed_at = now;
  }

  const { error } = await supabase
    .from("experiment_sessions")
    .update(sessionUpdate)
    .eq("id", sessionId)
    .eq("participant_id", participantId);

  if (error) {
    throw toServiceError(error, "Could not update experiment session.");
  }

  if (isCompletionStep) {
    const { error: participantError } = await supabase
      .from("participants")
      .update({
        completed_at: now
      })
      .eq("id", participantId);

    if (participantError) {
      throw toServiceError(participantError, "Could not mark participant complete.");
    }
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
    conditionAssignmentIndex:
      participant.condition_assignment_index ?? session.condition_assignment_index,
    roomTourCondition: participant.room_tour_condition || session.room_tour_condition,
    taskResponseCondition:
      participant.task_response_condition || session.task_response_condition,
    sessionId: session.id,
    currentFlowStep: session.current_flow_step,
    sessionStatus: session.status,
    startedAt: session.started_at,
    lastSeenAt: session.last_seen_at
  };
}

async function assignExperimentConditions(supabase) {
  const { data, error } = await supabase
    .rpc("assign_experiment_conditions")
    .single();

  if (error) {
    throw toServiceError(error, "Could not assign experiment condition.");
  }

  return {
    assignmentIndex: data.assignment_index,
    conditionId: data.condition_id,
    roomTourCondition: data.room_tour_condition,
    taskResponseCondition: data.task_response_condition
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
