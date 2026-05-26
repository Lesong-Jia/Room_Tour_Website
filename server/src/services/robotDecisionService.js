import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getOpenAIClient } from "./openaiSpeechService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECISION_MODEL = process.env.OPENAI_DECISION_MODEL || "gpt-5.2";

const promptFilesByFlowStep = {
  welcome_scene_start: "welcome_scene_start_prompt.txt",
  welcome_robot_greeting: "welcome_robot_greeting_prompt.txt",
  room_tour_explanation: "room_tour_explanation_prompt.txt",
  room_tour_target_answer: "room_tour_target_answer_prompt.txt",
  room_tour_preference_followup: "room_tour_preference_followup_prompt.txt",
  task_phase_instruction: "task_phase_instruction_prompt.txt",
  task_phase_start_reply: "task_phase_start_reply_prompt.txt",
  task_phase_clarification_answer: "task_phase_clarification_answer_prompt.txt"
};

const TASK_PHASE_TASKS = {
  making_coffee: {
    expectedInstruction: "make you a cup of coffee",
    clarificationAnswer: "Use the gray mug.",
    fixed: true
  },
  can_meat: {
    expectedInstruction: "prepare a can of tuna for you",
    clarificationAnswer: "Use the plate.",
    fixed: true
  },
  chopping_vegetables: {
    expectedInstruction: "slice a carrot for you",
    clarificationAnswer: "Use the small cutting board.",
    fixed: true
  },
  heating_food_microwave: {
    expectedInstruction: "heat the food on the stove with the microwave",
    clarificationAnswer: "Use the white one.",
    fixed: true
  },
  pick_up_trash: {
    expectedInstruction: "throw the trash on the table into the trash can",
    clarificationAnswer: "Put the recyclable trash in the white one.",
    fixed: true
  },
  boxing_books: {
    expectedInstruction: "put away the books on the sofa that you have already finished reading",
    clarificationAnswer: "Put the books in the bottom storage box.",
    fixed: true
  },
  clean_tv: {
    expectedInstruction: "clean the TV screen",
    clarificationAnswer: "Use the green one.",
    fixed: true
  },
  light_candle: {
    expectedInstruction: "light the scented candle",
    clarificationAnswer: "The scented candle is the green one.",
    fixed: true
  },
  turn_on_work_table_light: {
    expectedInstruction: "turn on the light on the work table"
  },
  hang_up_paint: {
    expectedInstruction: "hang up the painting on the work table"
  },
  pick_laptop_to_work_table: {
    expectedInstruction: "pick the laptop to the work table"
  },
  place_vase_top_shelf: {
    expectedInstruction: "place the antique vase on the second shelf from the top"
  },
  sort_tools_to_toolbox: {
    expectedInstruction: "put the tools into the toolbox"
  },
  put_leftovers_in_fridge: {
    expectedInstruction: "put the leftovers in the fridge"
  },
  replace_floor_lamp_bulb: {
    expectedInstruction: "replace the light bulb in the work table lamp"
  },
  spray_insecticide_houseplant: {
    expectedInstruction: "spray insecticide on the plant on the coffee table"
  }
};

const ROOM_TOUR_ITEMS = [
  { id: 1, label: "trash can" },
  { id: 2, label: "kitchen dining table" },
  { id: 3, label: "coffee machine" },
  { id: 4, label: "cutting board" },
  { id: 5, label: "microwave" },
  { id: 6, label: "rag" },
  { id: 7, label: "candle" },
  { id: 8, label: "shelf and bookshelf" }
];

const ROOM_TOUR_TARGET_ITEM_IDS = new Set([1, 4, 6, 7]);

const roomTourProgressBySession = new Map();

export function resetRoomTourProgress(context = {}) {
  const sessionKey = getRoomTourSessionKey(context);
  roomTourProgressBySession.delete(sessionKey);

  return {
    sessionKey,
    reset: true
  };
}

export async function decideRobotAction({ transcript, context }) {
  const flowStep = context.flowStep || context.phase || "welcome_scene_start";

  if (flowStep === "room_tour_explanation") {
    return decideRoomTourExplanation({ transcript, context, flowStep });
  }

  if (flowStep === "room_tour_target_answer") {
    return decideRoomTourTargetAnswer({ transcript, context, flowStep });
  }

  if (flowStep === "room_tour_preference_followup") {
    return decideRoomTourPreferenceFollowup({ transcript, context, flowStep });
  }

  if (flowStep === "task_phase_instruction") {
    return decideTaskPhaseInstruction({ transcript, context, flowStep });
  }

  if (flowStep === "task_phase_start_reply") {
    return decideTaskPhaseStartReply({ transcript, context, flowStep });
  }

  if (flowStep === "task_phase_clarification_answer") {
    return decideTaskPhaseClarificationAnswer({ transcript, context, flowStep });
  }

  const instructions = await getPromptForFlowStep(flowStep);
  const answer = await classifyTranscript({ instructions, transcript });
  const normalizedAnswer = normalizeYesNo(answer);

  return {
    flowStep,
    answer: normalizedAnswer,
    approved: normalizedAnswer === "Yes",
    intent: getIntent(flowStep, normalizedAnswer),
    feedback: getFeedback(flowStep, normalizedAnswer)
  };
}

async function decideRoomTourExplanation({ transcript, context, flowStep }) {
  const instructions = await getPromptForFlowStep(flowStep);
  const rawAnswer = await classifyTranscript({ instructions, transcript });
  const classification = parseRoomTourClassification(rawAnswer);
  const sessionKey = getRoomTourSessionKey(context);
  const progress = getRoomTourProgress(sessionKey);
  const matchedItem = ROOM_TOUR_ITEMS.find(
    (item) => item.id === classification.matchedItemId
  );
  const isRecordableRoomDetail = Boolean(matchedItem) || classification.isRoomDetail;

  if (matchedItem) {
    progress.coveredItemIds.add(matchedItem.id);

    if (ROOM_TOUR_TARGET_ITEM_IDS.has(matchedItem.id)) {
      progress.targetAnsweredItemIds.add(matchedItem.id);
    }
  }

  const coveredItemIds = Array.from(progress.coveredItemIds).sort((a, b) => a - b);
  const missingItemIds = ROOM_TOUR_ITEMS
    .map((item) => item.id)
    .filter((itemId) => !progress.coveredItemIds.has(itemId));

  return {
    flowStep,
    approved: isRecordableRoomDetail || classification.isComplete,
    intent: classification.isComplete
      ? "complete_room_tour_introduction"
      : matchedItem
        ? "record_room_tour_item"
        : classification.isRoomDetail
          ? "record_room_tour_detail"
          : "unmatched_room_tour_item",
    isComplete: classification.isComplete,
    summary: classification.summary,
    isRoomDetail: classification.isRoomDetail,
    matchedItemId: matchedItem?.id || null,
    matchedItemLabel: matchedItem?.label || "",
    confidence: classification.confidence,
    coveredItemIds,
    missingItemIds,
    coveredItems: coveredItemIds.map((itemId) =>
      ROOM_TOUR_ITEMS.find((item) => item.id === itemId)
    ),
    missingItems: missingItemIds.map((itemId) =>
      ROOM_TOUR_ITEMS.find((item) => item.id === itemId)
    ),
    targetQuestionItemIds: Array.from(ROOM_TOUR_TARGET_ITEM_IDS).sort((a, b) => a - b),
    answeredTargetItemIds: Array.from(progress.targetAnsweredItemIds).sort((a, b) => a - b),
    missingTargetItemIds: Array.from(ROOM_TOUR_TARGET_ITEM_IDS)
      .filter((itemId) => !progress.targetAnsweredItemIds.has(itemId))
      .sort((a, b) => a - b),
    feedback: isRecordableRoomDetail || classification.isComplete
      ? ""
      : "The robot did not hear a room detail to record."
  };
}

async function decideRoomTourTargetAnswer({ transcript, context, flowStep }) {
  const targetItemId = Number(context.targetItemId);
  const targetItem = ROOM_TOUR_ITEMS.find((item) => item.id === targetItemId);

  if (!targetItem || !ROOM_TOUR_TARGET_ITEM_IDS.has(targetItem.id)) {
    throw new Error(`Invalid Room Tour target question item: ${context.targetItemId}`);
  }

  const instructions = await getPromptForFlowStep(flowStep);
  const rawAnswer = await classifyTranscript({
    instructions,
    transcript,
    context: {
      targetItemId: targetItem.id,
      targetItemLabel: targetItem.label
    }
  });
  const classification = parseRoomTourTargetAnswerClassification(rawAnswer);
  const sessionKey = getRoomTourSessionKey(context);
  const progress = getRoomTourProgress(sessionKey);

  if (classification.isAnswer) {
    progress.coveredItemIds.add(targetItem.id);
    progress.targetAnsweredItemIds.add(targetItem.id);
  }

  const answeredTargetItemIds = Array.from(progress.targetAnsweredItemIds).sort((a, b) => a - b);
  const missingTargetItemIds = Array.from(ROOM_TOUR_TARGET_ITEM_IDS)
    .filter((itemId) => !progress.targetAnsweredItemIds.has(itemId))
    .sort((a, b) => a - b);

  return {
    flowStep,
    approved: classification.isAnswer,
    intent: classification.isAnswer
      ? "answer_room_tour_target_question"
      : "retry_room_tour_target_question",
    summary: classification.summary,
    targetItemId: targetItem.id,
    targetItemLabel: targetItem.label,
    confidence: classification.confidence,
    coveredItemIds: Array.from(progress.coveredItemIds).sort((a, b) => a - b),
    answeredTargetItemIds,
    missingTargetItemIds,
    feedback: classification.isAnswer
      ? ""
      : "The robot did not hear an answer related to the current room-tour question."
  };
}

async function decideRoomTourPreferenceFollowup({ transcript, context, flowStep }) {
  const instructions = await getPromptForFlowStep(flowStep);
  const rawAnswer = await classifyTranscript({ instructions, transcript });
  const classification = parseRoomTourPreferenceFollowupClassification(rawAnswer);
  const sessionKey = getRoomTourSessionKey(context);
  const progress = getRoomTourProgress(sessionKey);
  const matchedItem = ROOM_TOUR_ITEMS.find(
    (item) => item.id === classification.matchedItemId
  );

  if (classification.isRelevant && matchedItem) {
    progress.coveredItemIds.add(matchedItem.id);

    if (ROOM_TOUR_TARGET_ITEM_IDS.has(matchedItem.id)) {
      progress.targetAnsweredItemIds.add(matchedItem.id);
    }
  }

  return {
    flowStep,
    approved: classification.isRelevant || classification.isComplete,
    intent: classification.isComplete
      ? "complete_room_tour_introduction"
      : classification.isRelevant
        ? "record_room_tour_preference"
        : "unmatched_room_tour_preference",
    isComplete: classification.isComplete,
    summary: classification.summary,
    matchedItemId: matchedItem?.id || null,
    matchedItemLabel: matchedItem?.label || "",
    coveredItemIds: Array.from(progress.coveredItemIds).sort((a, b) => a - b),
    answeredTargetItemIds: Array.from(progress.targetAnsweredItemIds).sort((a, b) => a - b),
    confidence: classification.confidence,
    feedback: classification.isRelevant || classification.isComplete
      ? ""
      : "The robot did not hear a room-tour preference or additional detail."
  };
}

async function decideTaskPhaseInstruction({ transcript, context, flowStep }) {
  const taskId = normalizeTaskId(context.taskId);
  const task = getTaskPhaseTask(taskId);
  const instructions = await getPromptForFlowStep(flowStep);
  const rawAnswer = await classifyTranscript({
    instructions,
    transcript,
    context: {
      taskId,
      expectedInstruction: task.expectedInstruction,
      clarificationAnswer: task.clarificationAnswer || "",
      isFixedTask: task.fixed === true
    }
  });
  const classification = parseTaskPhaseInstructionClassification(rawAnswer);
  const clarificationAlreadyAnswered = toBoolean(
    context.clarificationAlreadyAnswered ||
      context.clarificationAnswered ||
      context.previousClarificationAnswered
  );
  const skipClarification =
    task.fixed === true &&
    (clarificationAlreadyAnswered || classification.includesClarificationAnswer);

  return {
    flowStep,
    taskId,
    approved: classification.isInstruction,
    intent: classification.isInstruction
      ? "task_instruction_accepted"
      : "task_instruction_rejected",
    skipClarification,
    includesClarificationAnswer: classification.includesClarificationAnswer,
    confidence: classification.confidence,
    feedback: classification.isInstruction
      ? ""
      : "Please follow the task prompt and ask the robot to do the quoted task.",
    unityCommand: classification.isInstruction
      ? {
          type: "task_instruction_accepted",
          skipClarification
        }
      : {
          type: "task_instruction_rejected"
        }
  };
}

async function decideTaskPhaseStartReply({ transcript, context, flowStep }) {
  const instructions = await getPromptForFlowStep(flowStep);
  const rawAnswer = await classifyTranscript({
    instructions,
    transcript,
    context: {
      taskId: context.taskId || "",
      condition: context.condition || ""
    }
  });
  const classification = parseTaskPhaseStartReplyClassification(rawAnswer);

  return {
    flowStep,
    taskId: context.taskId || "",
    condition: context.condition || "",
    approved: classification.answer === "yes" || classification.answer === "no",
    intent: classification.answer === "yes"
      ? "task_start_reply_yes"
      : classification.answer === "no"
        ? "task_start_reply_no"
        : "task_start_reply_unclear",
    answer: classification.answer,
    confidence: classification.confidence,
    feedback: classification.answer === "unclear"
      ? "Please answer yes or no to the robot's question."
      : "",
    unityCommand: classification.answer === "yes"
      ? { type: "task_start_reply_yes" }
      : classification.answer === "no"
        ? { type: "task_start_reply_no" }
        : null
  };
}

async function decideTaskPhaseClarificationAnswer({ transcript, context, flowStep }) {
  const taskId = normalizeTaskId(context.taskId);
  const task = getTaskPhaseTask(taskId);

  if (!task.fixed) {
    throw new Error(`Task does not have a fixed-task clarification: ${context.taskId}`);
  }

  const instructions = await getPromptForFlowStep(flowStep);
  const rawAnswer = await classifyTranscript({
    instructions,
    transcript,
    context: {
      taskId,
      clarificationAnswer: task.clarificationAnswer
    }
  });
  const classification = parseTaskPhaseClarificationAnswerClassification(rawAnswer);

  return {
    flowStep,
    taskId,
    approved: classification.isAnswer,
    intent: classification.isAnswer
      ? "task_clarification_answer_accepted"
      : "task_clarification_answer_rejected",
    confidence: classification.confidence,
    feedback: classification.isAnswer
      ? ""
      : "Please answer the clarification question using the highlighted hint.",
    unityCommand: classification.isAnswer
      ? { type: "task_clarification_answer_accepted" }
      : { type: "task_clarification_answer_rejected" }
  };
}

async function classifyTranscript({ instructions, transcript, context }) {
  const client = getOpenAIClient();

  const response = await client.responses.create({
    model: DECISION_MODEL,
    instructions,
    input: buildDecisionInput({ transcript, context })
  });

  return response.output_text?.trim() || "No";
}

function buildDecisionInput({ transcript, context }) {
  const contextLines = context
    ? Object.entries(context)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")
    : "";

  return [
    contextLines ? `Context:\n${contextLines}` : "",
    `Participant transcript:\n${transcript || ""}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function getPromptForFlowStep(flowStep) {
  const promptFile = promptFilesByFlowStep[flowStep];

  if (!promptFile) {
    throw new Error(`No decision prompt configured for flowStep: ${flowStep}`);
  }

  return readFile(join(__dirname, "..", "prompts", promptFile), "utf8");
}

function normalizeYesNo(answer) {
  const cleaned = answer.trim().toLowerCase();

  if (cleaned.startsWith("yes")) {
    return "Yes";
  }

  return "No";
}

function parseRoomTourClassification(answer) {
  try {
    const parsed = JSON.parse(extractJson(answer));
    const confidence = Number(parsed.confidence);

    return {
      summary: cleanSummary(parsed.summary),
      isComplete: parsed.isComplete === true,
      isRoomDetail: parsed.isRoomDetail === true,
      matchedItemId: normalizeRoomTourItemId(parsed.matchedItemId),
      confidence: Number.isFinite(confidence) ? confidence : 0
    };
  } catch {
    return {
      summary: cleanSummary(answer),
      isComplete: false,
      isRoomDetail: true,
      matchedItemId: null,
      confidence: 0
    };
  }
}

function parseRoomTourTargetAnswerClassification(answer) {
  try {
    const parsed = JSON.parse(extractJson(answer));
    const confidence = Number(parsed.confidence);

    return {
      summary: cleanSummary(parsed.summary),
      isAnswer: parsed.isAnswer === true,
      confidence: Number.isFinite(confidence) ? confidence : 0
    };
  } catch {
    return {
      summary: cleanSummary(answer),
      isAnswer: false,
      confidence: 0
    };
  }
}

function parseRoomTourPreferenceFollowupClassification(answer) {
  try {
    const parsed = JSON.parse(extractJson(answer));
    const confidence = Number(parsed.confidence);

    return {
      summary: cleanSummary(parsed.summary),
      isRelevant: parsed.isRelevant === true,
      isComplete: parsed.isComplete === true,
      matchedItemId: normalizeRoomTourItemId(parsed.matchedItemId),
      confidence: Number.isFinite(confidence) ? confidence : 0
    };
  } catch {
    return {
      summary: cleanSummary(answer),
      isRelevant: false,
      isComplete: false,
      matchedItemId: null,
      confidence: 0
    };
  }
}

function normalizeRoomTourItemId(value) {
  const matchedItemId = Number(value);

  return Number.isInteger(matchedItemId) && matchedItemId >= 1 && matchedItemId <= 8
    ? matchedItemId
    : null;
}

function parseTaskPhaseInstructionClassification(answer) {
  try {
    const parsed = JSON.parse(extractJson(answer));
    const confidence = Number(parsed.confidence);

    return {
      isInstruction: parsed.isInstruction === true,
      includesClarificationAnswer: parsed.includesClarificationAnswer === true,
      confidence: Number.isFinite(confidence) ? confidence : 0
    };
  } catch {
    return {
      isInstruction: normalizeYesNo(answer) === "Yes",
      includesClarificationAnswer: false,
      confidence: 0
    };
  }
}

function parseTaskPhaseStartReplyClassification(answer) {
  try {
    const parsed = JSON.parse(extractJson(answer));
    const confidence = Number(parsed.confidence);
    const normalizedAnswer = normalizeAnswerChoice(parsed.answer);

    return {
      answer: normalizedAnswer,
      confidence: Number.isFinite(confidence) ? confidence : 0
    };
  } catch {
    return {
      answer: normalizeAnswerChoice(answer),
      confidence: 0
    };
  }
}

function parseTaskPhaseClarificationAnswerClassification(answer) {
  try {
    const parsed = JSON.parse(extractJson(answer));
    const confidence = Number(parsed.confidence);

    return {
      isAnswer: parsed.isAnswer === true,
      confidence: Number.isFinite(confidence) ? confidence : 0
    };
  } catch {
    return {
      isAnswer: normalizeYesNo(answer) === "Yes",
      confidence: 0
    };
  }
}

function normalizeAnswerChoice(answer) {
  const cleaned = String(answer || "").trim().toLowerCase();

  if (cleaned.startsWith("yes")) {
    return "yes";
  }

  if (cleaned.startsWith("no")) {
    return "no";
  }

  return "unclear";
}

function extractJson(text) {
  const trimmed = (text || "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function cleanSummary(value) {
  const summary = String(value || "").trim();
  return summary ? summary.slice(0, 60) : "room detail";
}

function getTaskPhaseTask(taskId) {
  const normalizedTaskId = normalizeTaskId(taskId);
  const task = TASK_PHASE_TASKS[normalizedTaskId];

  if (!task) {
    throw new Error(`Unknown task phase taskId: ${taskId}`);
  }

  return task;
}

function normalizeTaskId(taskId) {
  return String(taskId || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const cleaned = String(value || "").trim().toLowerCase();
  return ["true", "yes", "1"].includes(cleaned);
}

function getRoomTourSessionKey(context) {
  return (
    context.sessionId ||
    context.participantId ||
    context.participantCode ||
    "local_room_tour_session"
  );
}

function getRoomTourProgress(sessionKey) {
  if (!roomTourProgressBySession.has(sessionKey)) {
    roomTourProgressBySession.set(sessionKey, {
      coveredItemIds: new Set(),
      targetAnsweredItemIds: new Set()
    });
  }

  return roomTourProgressBySession.get(sessionKey);
}

function getIntent(flowStep, answer) {
  if (answer !== "Yes") {
    return "unknown";
  }

  if (flowStep === "welcome_robot_greeting") {
    return "greet_robot";
  }

  return "start_scene";
}

function getFeedback(flowStep, answer) {
  if (answer === "Yes") {
    return "";
  }

  if (flowStep === "welcome_robot_greeting") {
    return "Please use the voice input button to say hi to Aria.";
  }

  return 'Please follow the instruction and say "start the scene".';
}
