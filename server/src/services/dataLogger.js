import { updateSessionFlowStep } from "./sessionService.js";
import { getSupabaseClient } from "./supabaseService.js";
import { extname } from "node:path";

const SPEECH_AUDIO_BUCKET = "speech-turn-audio";
let speechAudioBucketReady = false;

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

export async function clearCurrentFlowStepData(request) {
  validateCurrentFlowStepClearRequest(request);

  const supabase = getSupabaseClient();
  const currentFlowStep = request.currentFlowStep;
  const sessionId = request.sessionId;

  switch (currentFlowStep) {
    case "welcome":
    case "practice_calibration":
      await deleteSpeechTurnsByFlowSteps(supabase, sessionId, [
        "welcome_scene_start",
        "welcome_robot_greeting"
      ]);
      break;
    case "pre_experiment_questionnaire":
      await deleteRows(
        supabase
          .from("pre_experiment_questionnaire")
          .delete()
          .eq("session_id", sessionId),
        "Could not clear pre-experiment questionnaire."
      );
      break;
    case "phase_2_room_tour":
    case "room_tour":
      await deleteRows(
        supabase
          .from("room_tour_results")
          .delete()
          .eq("session_id", sessionId),
        "Could not clear Room Tour result."
      );
      await deleteSpeechTurnsByPhase(supabase, sessionId, "phase_2_room_tour");
      await deleteSpeechTurnsByFlowSteps(supabase, sessionId, [
        "room_tour_explanation",
        "room_tour_target_answer",
        "room_tour_preference_followup"
      ]);
      break;
    case "next_experiment_placeholder":
      await clearTaskPhaseData(supabase, sessionId, "phase_2_task_phase");
      break;
    case "phase_2_end_questionnaire":
      await deletePhaseEndQuestionnaire(supabase, sessionId, "phase_2_end_questionnaire");
      break;
    case "phase_3_task_phase":
      await clearTaskPhaseData(supabase, sessionId, "phase_3_task_phase");
      break;
    case "phase_3_end_questionnaire":
      await deletePhaseEndQuestionnaire(supabase, sessionId, "phase_3_end_questionnaire");
      break;
    default:
      break;
  }

  return {
    ok: true,
    currentFlowStep
  };
}

export async function logSpeechTurn(turn) {
  validateSpeechTurn(turn);

  const supabase = getSupabaseClient();
  const audioStorage = await uploadSpeechTurnAudio(supabase, turn);
  const row = buildSpeechTurnRow(turn, audioStorage);

  const { data, error } = await supabase
    .from("speech_turns")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    throw toServiceError(error, "Could not save speech turn.");
  }

  return {
    speechTurnId: data.id,
    audioStorage
  };
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
      onConflict: "session_id,phase,task_id"
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
    room_tour_condition: result.roomTourCondition || result.metadata?.roomTourCondition || null,
    metadata: {
      ...(result.metadata || {}),
      roomTourCondition: result.roomTourCondition || result.metadata?.roomTourCondition || null
    },
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
    task_response_condition:
      result.taskResponseCondition || result.metadata?.taskResponseCondition || null,
    outcome: result.outcome || null,
    difficulty_rating: toLikertNumber(ratings.difficulty),
    danger_rating: toLikertNumber(ratings.danger),
    experience_rating: toLikertNumber(ratings.experience),
    trust_rating: toLikertNumber(ratings.trust),
    ratings,
    submitted_at_browser: result.submittedAtBrowser || null,
    submitted_at_server: new Date().toISOString(),
    metadata: {
      ...(result.metadata || {}),
      taskResponseCondition:
        result.taskResponseCondition || result.metadata?.taskResponseCondition || null
    },
    updated_at: new Date().toISOString()
  };
}

function buildSpeechTurnRow(turn, audioStorage) {
  const context = turn.context || {};

  return {
    turn_id: turn.turnId,
    participant_id: context.participantId,
    participant_code: context.participantCode || "",
    session_id: context.sessionId,
    phase: context.phase || null,
    flow_step: context.flowStep || null,
    task_id: context.taskId || null,
    task_condition: context.condition || null,
    room_tour_condition: context.roomTourCondition || null,
    task_response_condition: context.taskResponseCondition || null,
    target_item_id: context.targetItemId ? String(context.targetItemId) : null,
    target_item_label: context.targetItemLabel || null,
    transcript: turn.transcript || "",
    decision: turn.decision || {},
    context,
    error_message: turn.errorMessage || null,
    audio_storage_bucket: audioStorage?.bucket || null,
    audio_storage_path: audioStorage?.path || null,
    audio_original_name: turn.audio?.originalname || null,
    audio_mime_type: turn.audio?.mimetype || null,
    audio_size_bytes: Number.isInteger(turn.audio?.size) ? turn.audio.size : null,
    submitted_at_server: new Date().toISOString()
  };
}

async function uploadSpeechTurnAudio(supabase, turn) {
  if (!turn.audio?.buffer) {
    return null;
  }

  await ensureSpeechAudioBucket(supabase);

  const context = turn.context || {};
  const extension = getAudioExtension(turn.audio);
  const path = [
    sanitizePathSegment(context.participantId),
    sanitizePathSegment(context.sessionId),
    `${sanitizePathSegment(turn.turnId)}${extension}`
  ].join("/");

  const { error } = await supabase.storage
    .from(SPEECH_AUDIO_BUCKET)
    .upload(path, turn.audio.buffer, {
      contentType: turn.audio.mimetype || "application/octet-stream",
      upsert: false
    });

  if (error) {
    throw toServiceError(error, "Could not upload speech audio.");
  }

  return {
    bucket: SPEECH_AUDIO_BUCKET,
    path
  };
}

async function ensureSpeechAudioBucket(supabase) {
  if (speechAudioBucketReady) {
    return;
  }

  const { error } = await supabase.storage.createBucket(SPEECH_AUDIO_BUCKET, {
    public: false
  });

  if (
    error &&
    error.statusCode !== "409" &&
    error.statusCode !== 409 &&
    !String(error.message || "").toLowerCase().includes("already exists")
  ) {
    throw toServiceError(error, "Could not prepare speech audio storage.");
  }

  speechAudioBucketReady = true;
}

async function clearTaskPhaseData(supabase, sessionId, phase) {
  await deleteRows(
    supabase
      .from("task_phase_trial_results")
      .delete()
      .eq("session_id", sessionId)
      .eq("phase", phase),
    "Could not clear task phase trial results."
  );
  await deleteRows(
    supabase
      .from("task_phase_clarification_status")
      .delete()
      .eq("session_id", sessionId)
      .eq("phase", phase),
    "Could not clear task phase clarification status."
  );
  await deleteSpeechTurnsByPhase(supabase, sessionId, phase);
}

async function deletePhaseEndQuestionnaire(supabase, sessionId, phase) {
  await deleteRows(
    supabase
      .from("phase_end_questionnaire_submissions")
      .delete()
      .eq("session_id", sessionId)
      .eq("phase", phase),
    "Could not clear phase-end questionnaire."
  );
}

async function deleteSpeechTurnsByPhase(supabase, sessionId, phase) {
  await deleteSpeechTurnAudioByPhase(supabase, sessionId, phase);
  await deleteRows(
    supabase
      .from("speech_turns")
      .delete()
      .eq("session_id", sessionId)
      .eq("phase", phase),
    "Could not clear speech turns."
  );
}

async function deleteSpeechTurnsByFlowSteps(supabase, sessionId, flowSteps) {
  if (!flowSteps?.length) {
    return;
  }

  await deleteSpeechTurnAudioByFlowSteps(supabase, sessionId, flowSteps);
  await deleteRows(
    supabase
      .from("speech_turns")
      .delete()
      .eq("session_id", sessionId)
      .in("flow_step", flowSteps),
    "Could not clear speech turns."
  );
}

async function deleteSpeechTurnAudioByPhase(supabase, sessionId, phase) {
  const { data, error } = await supabase
    .from("speech_turns")
    .select("audio_storage_path")
    .eq("session_id", sessionId)
    .eq("phase", phase);

  if (error) {
    throw toServiceError(error, "Could not read speech audio paths.");
  }

  await deleteSpeechAudioPaths(supabase, data);
}

async function deleteSpeechTurnAudioByFlowSteps(supabase, sessionId, flowSteps) {
  const { data, error } = await supabase
    .from("speech_turns")
    .select("audio_storage_path")
    .eq("session_id", sessionId)
    .in("flow_step", flowSteps);

  if (error) {
    throw toServiceError(error, "Could not read speech audio paths.");
  }

  await deleteSpeechAudioPaths(supabase, data);
}

async function deleteSpeechAudioPaths(supabase, rows) {
  const paths = Array.from(
    new Set((rows || []).map((row) => row.audio_storage_path).filter(Boolean))
  );

  if (paths.length === 0) {
    return;
  }

  const { error } = await supabase.storage
    .from(SPEECH_AUDIO_BUCKET)
    .remove(paths);

  if (error) {
    throw toServiceError(error, "Could not clear speech audio files.");
  }
}

async function deleteRows(query, fallbackMessage) {
  const { error } = await query;

  if (error) {
    throw toServiceError(error, fallbackMessage);
  }
}

function getAudioExtension(audio) {
  const fromName = extname(audio.originalname || "").toLowerCase();
  if (fromName) {
    return fromName;
  }

  if (audio.mimetype === "audio/mp4") {
    return ".mp4";
  }

  if (audio.mimetype === "audio/wav" || audio.mimetype === "audio/wave") {
    return ".wav";
  }

  return ".webm";
}

function sanitizePathSegment(value) {
  return String(value || "unknown")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function buildTaskPhaseClarificationStatusRow(result) {
  return {
    participant_id: result.participantId,
    participant_code: result.participantCode || "",
    session_id: result.sessionId,
    phase: result.phase || result.metadata?.phase || "",
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
  const attentionCheck = answersByQuestion.get("QID_ATTENTION_1");

  return {
    participant_id: submission.participantId,
    participant_code: submission.participantCode || "",
    session_id: submission.sessionId,
    source_survey_id: submission.sourceSurveyId || null,
    submitted_at_browser: submission.submittedAtBrowser || null,
    submitted_at_server: new Date().toISOString(),
    age: getAnswerValue(answersByQuestion.get("QID3")),
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
      answerCount: submission.answers.length,
      attentionCheck: {
        questionId: attentionCheck?.questionId || "QID_ATTENTION_1",
        value: attentionCheck?.value || null,
        label: getAnswerLabel(attentionCheck),
        expectedValue: attentionCheck?.metadata?.expectedValue || "4",
        passed: attentionCheck?.metadata?.passed === true
      }
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

function getAnswerValue(answer) {
  return answer?.value || null;
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

function validateSpeechTurn(turn) {
  const context = turn?.context || {};
  const requiredFields = ["turnId"];
  const missingField = requiredFields.find((field) => !turn?.[field]);

  if (missingField) {
    const error = new Error(`Missing speech turn field: ${missingField}`);
    error.status = 400;
    throw error;
  }

  for (const field of ["participantId", "sessionId"]) {
    if (!context[field]) {
      const error = new Error(`Missing speech turn context field: ${field}`);
      error.status = 400;
      throw error;
    }
  }
}

function validateCurrentFlowStepClearRequest(request) {
  const requiredFields = ["participantId", "sessionId", "currentFlowStep"];
  const missingField = requiredFields.find((field) => !request?.[field]);

  if (missingField) {
    const error = new Error(`Missing current page cleanup field: ${missingField}`);
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

  for (const ratingKey of ["experience", "trust"]) {
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
