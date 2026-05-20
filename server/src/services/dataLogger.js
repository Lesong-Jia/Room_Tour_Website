import { updateSessionFlowStep } from "./sessionService.js";
import { getSupabaseClient } from "./supabaseService.js";

const ROOM_TOUR_ITEM_TO_FIXED_TASK_IDS = {
  1: ["pick_up_trash"],
  2: ["can_meat"],
  3: ["making_coffee"],
  4: ["chopping_vegetables"],
  5: ["heating_food_microwave"],
  6: ["clean_tv"],
  7: ["light_candle"],
  8: ["boxing_books"]
};

export async function logExperimentEvent(event) {
  console.info("Experiment event placeholder:", event);
}

export async function logUnityEvent(event) {
  console.info("Unity event placeholder:", event);
}

export async function logRoomTourResult(result) {
  validateRoomTourResult(result);

  const supabase = getSupabaseClient();
  const row = buildRoomTourResultRow(result);

  const { data, error } = await supabase
    .from("room_tour_results")
    .upsert(row, {
      onConflict: "session_id"
    })
    .select("id")
    .single();

  if (error) {
    throw toServiceError(error, "Could not save Room Tour result.");
  }

  return {
    resultId: data.id
  };
}

export async function logTaskPhaseTrialResult(result) {
  validateTaskPhaseTrialResult(result);

  const supabase = getSupabaseClient();
  const row = buildTaskPhaseTrialResultRow(result);

  const { data, error } = await supabase
    .from("task_phase_trial_results")
    .upsert(row, {
      onConflict: "session_id,phase,task_index"
    })
    .select("id")
    .single();

  if (error) {
    throw toServiceError(error, "Could not save task phase trial result.");
  }

  return {
    resultId: data.id
  };
}

export async function getTaskPhaseClarificationStatus(query) {
  validateClarificationIdentity(query);

  const supabase = getSupabaseClient();
  const [roomTourStatus, explicitStatus] = await Promise.all([
    getRoomTourDerivedClarificationStatus(supabase, query.sessionId),
    getExplicitClarificationStatus(supabase, query.sessionId)
  ]);

  return {
    clarifiedTasks: {
      ...roomTourStatus,
      ...explicitStatus
    },
    sources: {
      roomTour: roomTourStatus,
      taskPhase: explicitStatus
    }
  };
}

export async function markTaskPhaseClarification(result) {
  validateTaskPhaseClarificationMark(result);

  const supabase = getSupabaseClient();
  const row = buildTaskPhaseClarificationStatusRow(result);

  const { data, error } = await supabase
    .from("task_phase_clarification_status")
    .upsert(row, {
      onConflict: "session_id,task_id"
    })
    .select("id")
    .single();

  if (error) {
    throw toServiceError(error, "Could not save task phase clarification status.");
  }

  return {
    clarificationStatusId: data.id
  };
}

export async function logQuestionnaireSubmission(submission) {
  validateQuestionnaireSubmission(submission);

  if (isPreExperimentQuestionnaire(submission)) {
    const result = await logPreExperimentQuestionnaire(submission);

    if (submission.nextFlowStep) {
      await updateSessionFlowStep({
        participantId: submission.participantId,
        sessionId: submission.sessionId,
        currentFlowStep: submission.nextFlowStep
      });
    }

    return result;
  }

  if (isPhaseEndQuestionnaire(submission)) {
    const result = await logPhaseEndQuestionnaire(submission);

    if (submission.nextFlowStep) {
      await updateSessionFlowStep({
        participantId: submission.participantId,
        sessionId: submission.sessionId,
        currentFlowStep: submission.nextFlowStep
      });
    }

    return result;
  }

  const error = new Error(
    `Unsupported questionnaire storage target: ${submission.questionnaireScope}/${submission.phase}`
  );
  error.status = 400;
  throw error;
}

async function logPreExperimentQuestionnaire(submission) {
  const supabase = getSupabaseClient();
  const row = buildPreExperimentQuestionnaireRow(submission);

  const { data, error } = await supabase
    .from("pre_experiment_questionnaire")
    .upsert(row, {
      onConflict: "participant_id"
    })
    .select("id")
    .single();

  if (error) {
    throw toServiceError(
      error,
      "Could not save pre-experiment questionnaire."
    );
  }

  return {
    submissionId: data.id
  };
}

function buildRoomTourResultRow(result) {
  return {
    participant_id: result.participantId,
    participant_code: result.participantCode || "",
    session_id: result.sessionId,
    submitted_at_browser: result.submittedAtBrowser || null,
    submitted_at_server: new Date().toISOString(),
    recorded_items: result.recordedItems || [],
    covered_item_ids: result.coveredItemIds || [],
    target_answered_item_ids: result.targetAnsweredItemIds || [],
    target_items_status: result.targetItemsStatus || {},
    metadata: result.metadata || {},
    updated_at: new Date().toISOString()
  };
}

function buildTaskPhaseTrialResultRow(result) {
  const ratings = result.ratings || {};

  return {
    participant_id: result.participantId,
    participant_code: result.participantCode || "",
    session_id: result.sessionId,
    phase: result.phase || result.metadata?.phase || "phase_2_task_phase",
    task_id: result.taskId,
    task_index: toInteger(result.taskIndex),
    task_count: toInteger(result.taskCount),
    condition: result.condition || null,
    outcome: result.outcome || null,
    difficulty_rating: toLikertNumber(ratings.difficulty),
    danger_rating: toLikertNumber(ratings.danger),
    experience_rating: toLikertNumber(ratings.experience),
    trust_rating: toLikertNumber(ratings.trust),
    ratings,
    submitted_at_browser: result.submittedAtBrowser || null,
    submitted_at_server: new Date().toISOString(),
    metadata: result.metadata || {},
    updated_at: new Date().toISOString()
  };
}

function buildTaskPhaseClarificationStatusRow(result) {
  return {
    participant_id: result.participantId,
    participant_code: result.participantCode || "",
    session_id: result.sessionId,
    task_id: result.taskId,
    clarified: result.clarified !== false,
    source: result.source || "task_phase",
    submitted_at_browser: result.submittedAtBrowser || null,
    submitted_at_server: new Date().toISOString(),
    metadata: result.metadata || {},
    updated_at: new Date().toISOString()
  };
}

async function logPhaseEndQuestionnaire(submission) {
  const supabase = getSupabaseClient();
  const row = buildPhaseEndQuestionnaireRow(submission);

  const { data, error } = await supabase
    .from("phase_end_questionnaire_submissions")
    .upsert(row, {
      onConflict: "session_id,phase"
    })
    .select("id")
    .single();

  if (error) {
    throw toServiceError(error, "Could not save phase-end questionnaire.");
  }

  return {
    submissionId: data.id
  };
}

function buildPreExperimentQuestionnaireRow(submission) {
  const answersByQuestion = new Map(
    submission.answers.map((answer) => [answer.questionId, answer])
  );
  const attitude = answersByQuestion.get("QID13")?.value || {};
  const bfi = answersByQuestion.get("QID12")?.value || {};

  return {
    participant_id: submission.participantId,
    participant_code: submission.participantCode || "",
    session_id: submission.sessionId,
    source_survey_id: submission.sourceSurveyId || null,
    submitted_at_browser: submission.submittedAtBrowser || null,
    submitted_at_server: new Date().toISOString(),
    age: getAnswerLabel(answersByQuestion.get("QID3")),
    gender: getAnswerLabel(answersByQuestion.get("QID4")),
    gender_self_description: getOtherText(answersByQuestion.get("QID4")),
    robot_types: getAnswerLabels(answersByQuestion.get("QID5")),
    other_robot_type: getOtherText(answersByQuestion.get("QID5")),
    robot_vacuum_experience: getAnswerLabel(answersByQuestion.get("QID6")),
    smart_home_robot_experience: getAnswerLabel(answersByQuestion.get("QID7")),
    delivery_robot_experience: getAnswerLabel(answersByQuestion.get("QID8")),
    robotic_arm_experience: getAnswerLabel(answersByQuestion.get("QID10")),
    educational_robot_experience: getAnswerLabel(answersByQuestion.get("QID11")),
    other_robot_experience: getAnswerLabel(answersByQuestion.get("QID9")),
    attitude_good_idea: toLikertNumber(attitude["1"]),
    attitude_life_interesting: toLikertNumber(attitude["2"]),
    attitude_good_to_use: toLikertNumber(attitude["3"]),
    attitude_trust_tasks: toLikertNumber(attitude["4"]),
    attitude_rely_tasks: toLikertNumber(attitude["5"]),
    bfi_reserved: toLikertNumber(bfi["1"]),
    bfi_generally_trusting: toLikertNumber(bfi["2"]),
    bfi_lazy: toLikertNumber(bfi["3"]),
    bfi_relaxed_handles_stress: toLikertNumber(bfi["4"]),
    bfi_few_artistic_interests: toLikertNumber(bfi["5"]),
    bfi_outgoing_sociable: toLikertNumber(bfi["6"]),
    bfi_finds_fault: toLikertNumber(bfi["7"]),
    bfi_thorough_job: toLikertNumber(bfi["8"]),
    bfi_nervous_easily: toLikertNumber(bfi["9"]),
    bfi_active_imagination: toLikertNumber(bfi["10"]),
    metadata: {
      questionnaireId: submission.questionnaireId,
      questionnaireScope: submission.questionnaireScope,
      phase: submission.phase,
      answerCount: submission.answers.length
    },
    updated_at: new Date().toISOString()
  };
}

function buildPhaseEndQuestionnaireRow(submission) {
  return {
    participant_id: submission.participantId,
    participant_code: submission.participantCode || "",
    session_id: submission.sessionId,
    questionnaire_id: submission.questionnaireId,
    phase: submission.phase,
    submitted_at_browser: submission.submittedAtBrowser || null,
    submitted_at_server: new Date().toISOString(),
    answers: submission.answers || [],
    metadata: {
      questionnaireId: submission.questionnaireId,
      questionnaireScope: submission.questionnaireScope,
      phase: submission.phase,
      answerCount: submission.answers.length,
      ...(submission.metadata || {})
    },
    updated_at: new Date().toISOString()
  };
}

function getAnswerLabel(answer) {
  if (!answer) {
    return null;
  }

  if (typeof answer.labels === "string") {
    return answer.labels || null;
  }

  return answer.value || null;
}

function getAnswerLabels(answer) {
  if (!answer) {
    return [];
  }

  return Array.isArray(answer.labels) ? answer.labels : [];
}

function getOtherText(answer) {
  return answer?.otherText?.trim() || null;
}

function toLikertNumber(value) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function isPreExperimentQuestionnaire(submission) {
  return (
    submission.questionnaireScope === "pre_experiment" ||
    submission.phase === "pre_experiment_questionnaire"
  );
}

function isPhaseEndQuestionnaire(submission) {
  return (
    submission.questionnaireScope === "phase_end" ||
    submission.phase === "phase_2_end_questionnaire" ||
    submission.phase === "phase_3_end_questionnaire"
  );
}

function validateRoomTourResult(result) {
  const requiredFields = ["participantId", "sessionId"];
  const missingField = requiredFields.find((field) => !result?.[field]);

  if (missingField) {
    const error = new Error(`Missing Room Tour result field: ${missingField}`);
    error.status = 400;
    throw error;
  }

  if (result.recordedItems && !Array.isArray(result.recordedItems)) {
    const error = new Error("Room Tour recordedItems must be an array.");
    error.status = 400;
    throw error;
  }
}

function validateTaskPhaseTrialResult(result) {
  const requiredFields = [
    "participantId",
    "sessionId",
    "taskId",
    "taskIndex",
    "taskCount",
    "ratings"
  ];
  const missingField = requiredFields.find((field) => !result?.[field]);

  if (missingField) {
    const error = new Error(`Missing task phase trial result field: ${missingField}`);
    error.status = 400;
    throw error;
  }

  for (const ratingKey of ["difficulty", "danger", "experience", "trust"]) {
    const rating = toLikertNumber(result.ratings?.[ratingKey]);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      const error = new Error(`Invalid task phase rating: ${ratingKey}`);
      error.status = 400;
      throw error;
    }
  }
}

function validateClarificationIdentity(query) {
  const requiredFields = ["sessionId"];
  const missingField = requiredFields.find((field) => !query?.[field]);

  if (missingField) {
    const error = new Error(`Missing clarification status field: ${missingField}`);
    error.status = 400;
    throw error;
  }
}

function validateTaskPhaseClarificationMark(result) {
  const requiredFields = ["participantId", "sessionId", "taskId"];
  const missingField = requiredFields.find((field) => !result?.[field]);

  if (missingField) {
    const error = new Error(`Missing clarification mark field: ${missingField}`);
    error.status = 400;
    throw error;
  }
}

async function getRoomTourDerivedClarificationStatus(supabase, sessionId) {
  const { data, error } = await supabase
    .from("room_tour_results")
    .select("covered_item_ids,target_answered_item_ids")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    throw toServiceError(error, "Could not read Room Tour clarification bridge.");
  }

  if (!data) {
    return {};
  }

  const coveredItemIds = normalizeJsonIdList(data.covered_item_ids);
  const targetAnsweredItemIds = normalizeJsonIdList(data.target_answered_item_ids);
  const availableItemIds = new Set([...coveredItemIds, ...targetAnsweredItemIds]);
  const status = {};

  for (const itemId of availableItemIds) {
    for (const taskId of ROOM_TOUR_ITEM_TO_FIXED_TASK_IDS[itemId] || []) {
      status[taskId] = true;
    }
  }

  return status;
}

async function getExplicitClarificationStatus(supabase, sessionId) {
  const { data, error } = await supabase
    .from("task_phase_clarification_status")
    .select("task_id,clarified")
    .eq("session_id", sessionId);

  if (error) {
    throw toServiceError(error, "Could not read task phase clarification status.");
  }

  return (data || []).reduce((status, row) => ({
    ...status,
    [row.task_id]: row.clarified === true
  }), {});
}

function normalizeJsonIdList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((itemId) => Number(itemId))
    .filter((itemId) => Number.isInteger(itemId));
}

function toInteger(value) {
  const numericValue = Number(value);

  return Number.isInteger(numericValue) ? numericValue : null;
}

function validateQuestionnaireSubmission(submission) {
  const requiredFields = [
    "participantId",
    "sessionId",
    "questionnaireId",
    "questionnaireScope",
    "phase"
  ];
  const missingField = requiredFields.find((field) => !submission?.[field]);

  if (missingField) {
    const error = new Error(`Missing questionnaire submission field: ${missingField}`);
    error.status = 400;
    throw error;
  }

  if (!Array.isArray(submission.answers)) {
    const error = new Error("Questionnaire answers must be an array.");
    error.status = 400;
    throw error;
  }
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
