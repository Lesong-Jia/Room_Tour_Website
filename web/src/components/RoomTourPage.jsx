import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  resetRoomTourProgress,
  submitRoomTourCompletion
} from "../experiment/api.js";
import { sendUnityCommand } from "../experiment/unityBridge.js";
import {
  isRobotLeadCondition
} from "../experiment/roomTourCondition.js";
import UnityContainer from "./UnityContainer.jsx";
import VoiceRecorder from "./VoiceRecorder.jsx";

const ROOM_TOUR_UNITY_BASE_PATH = "/unity/Room_Tour";
const ROOM_TOUR_UNITY_BUILD_PATH = `${ROOM_TOUR_UNITY_BASE_PATH}/Build`;
const ROOM_TOUR_UNITY_FILE_PREFIX = "Room_Tour";
const ROOM_TOUR_UNITY_COMMAND_TARGET = {
  objectName: "Progress_Manager",
  methodName: "HandleHostCommand"
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
const TARGET_ROOM_TOUR_ITEMS = [
  { id: 1, label: "trash can", commandKey: "trashCanCovered" },
  { id: 4, label: "cutting board", commandKey: "cuttingBoardCovered" },
  { id: 6, label: "rag", commandKey: "ragCovered" },
  { id: 7, label: "candle", commandKey: "candleCovered" }
];
const TARGET_ROOM_TOUR_ANSWERS = {
  1: "White trash can for recyclable trash; black trash can for non-recyclable trash.",
  4: "Small dark cutting board is for vegetables and fruit; large light cutting board is for meat.",
  6: "Green rag is for screens; blue rag is for tables.",
  7: "Long thin white candle is decorative; green candle is bamboo-scented aromatherapy."
};

export default function RoomTourPage({ identity, onComplete }) {
  const [unityLoaded, setUnityLoaded] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [interactionStarted, setInteractionStarted] = useState(false);
  const [introCompleted, setIntroCompleted] = useState(false);
  const [recordedItems, setRecordedItems] = useState([]);
  const [coveredItemIds, setCoveredItemIds] = useState([]);
  const [targetAnsweredItemIds, setTargetAnsweredItemIds] = useState([]);
  const [roomTourPhase, setRoomTourPhase] = useState("free_tour");
  const [currentTargetItemId, setCurrentTargetItemId] = useState(null);
  const [preferenceResponseCount, setPreferenceResponseCount] = useState(0);
  const [finalCompleted, setFinalCompleted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [unityStatus, setUnityStatus] = useState("");
  const [robotSpeaking, setRobotSpeaking] = useState(false);
  const [showPostQuestionsCompletionHint, setShowPostQuestionsCompletionHint] =
    useState(false);
  const [showFreeTourCompletionHint, setShowFreeTourCompletionHint] =
    useState(false);
  const [robotLeadTargetQuestionsActive, setRobotLeadTargetQuestionsActive] =
    useState(false);
  const roomTourResetKeyRef = useRef("");
  const completionSubmittedRef = useRef(false);
  const targetQuestionSequenceStartedRef = useRef(false);
  const targetAnswerSubmittedRef = useRef(false);
  const roomTourCondition = identity?.roomTourCondition || "";

  const unityConfig = useMemo(
    () => ({
      arguments: [],
      dataUrl: `${ROOM_TOUR_UNITY_BUILD_PATH}/${ROOM_TOUR_UNITY_FILE_PREFIX}.data.br`,
      frameworkUrl: `${ROOM_TOUR_UNITY_BUILD_PATH}/${ROOM_TOUR_UNITY_FILE_PREFIX}.framework.js.br`,
      codeUrl: `${ROOM_TOUR_UNITY_BUILD_PATH}/${ROOM_TOUR_UNITY_FILE_PREFIX}.wasm.br`,
      streamingAssetsUrl: `${ROOM_TOUR_UNITY_BASE_PATH}/StreamingAssets`,
      companyName: "DefaultCompany",
      productName: "Room_Tour_User_Lead",
      productVersion: "0.1"
    }),
    []
  );

  const unityLoaderUrl =
    `${ROOM_TOUR_UNITY_BUILD_PATH}/${ROOM_TOUR_UNITY_FILE_PREFIX}.loader.js`;

  const handleUnityReady = useCallback(() => {
    setUnityLoaded(true);
  }, []);

  useEffect(() => {
    function handleUnityEvent(event) {
      const detail = normalizeUnityEvent(event.detail);

      if (detail?.type === "room_tour_scene_ready") {
        setSceneReady(true);
        setUnityStatus("");
      }

      if (
        detail?.type === "room_tour_intro_started" ||
        detail?.type === "room_tour_confirmation_started"
      ) {
        setRobotSpeaking(true);
      }

      if (detail?.type === "room_tour_condition_requested") {
        if (roomTourCondition) {
          sendUnityCommand({
            type: "set_room_tour_condition",
            condition: roomTourCondition
          }, ROOM_TOUR_UNITY_COMMAND_TARGET);
        }
      }

      if (detail?.type === "room_tour_intro_completed") {
        setIntroCompleted(true);
        if (isRobotLeadCondition(roomTourCondition)) {
          setRobotSpeaking(true);
          setRoomTourPhase("target_transition");
          setRobotLeadTargetQuestionsActive(true);
        } else {
          setRobotSpeaking(false);
          setRoomTourPhase("free_tour");
        }
        setUnityStatus("");
      }

      if (detail?.type === "room_tour_confirmation_completed") {
        setRobotSpeaking(false);
      }

      if (detail?.type === "room_tour_target_question_ready") {
        setRobotSpeaking(false);
        targetAnswerSubmittedRef.current = false;
        setCurrentTargetItemId(Number(detail.itemId) || null);
        setRoomTourPhase("target_answer");
        setFeedback("");
        setUnityStatus("");
      }

      if (detail?.type === "room_tour_target_questions_completed") {
        setRobotSpeaking(false);
        targetAnswerSubmittedRef.current = false;
        setCurrentTargetItemId(null);
        setRoomTourPhase("post_questions");
        setRobotLeadTargetQuestionsActive(false);
        setShowPostQuestionsCompletionHint(false);
        setFeedback("");
        setUnityStatus("");
      }

      if (detail?.type === "room_tour_error") {
        const message = detail.message || "Unity reported a Room Tour error.";
        setUnityStatus(message);
        setFeedback(message);
        setRoomTourPhase((phase) =>
          phase === "target_transition" ? "post_questions" : phase
        );
        setCurrentTargetItemId(null);
        setRobotSpeaking(false);
        targetAnswerSubmittedRef.current = false;
      }

      if (
        detail?.type === "room_tour_additional_followup_ready"
      ) {
        setRobotSpeaking(false);
        setRobotLeadTargetQuestionsActive(false);
        setRoomTourPhase("additional_followup");
        setShowPostQuestionsCompletionHint(false);
        setFeedback("");
      }

      if (detail?.type === "room_tour_additional_followup_completed") {
        setRobotSpeaking(false);
      }

      if (detail?.type === "room_tour_false_condition_completed") {
        setRobotSpeaking(false);
        void completeFalseRoomTourCondition();
      }
    }

    window.addEventListener("unity-experiment-event", handleUnityEvent);

    return () => {
      window.removeEventListener("unity-experiment-event", handleUnityEvent);
    };
  }, [roomTourCondition]);

  useEffect(() => {
    if (!identity?.sessionId) {
      return;
    }

    const resetKey = `${identity.sessionId}:room_tour_page_load`;
    if (roomTourResetKeyRef.current === resetKey) {
      return;
    }

    roomTourResetKeyRef.current = resetKey;
    completionSubmittedRef.current = false;
    setRecordedItems([]);
    setCoveredItemIds([]);
    setTargetAnsweredItemIds([]);
    setRoomTourPhase("free_tour");
    setCurrentTargetItemId(null);
    setFinalCompleted(false);
    setFeedback("");
    setRobotSpeaking(false);
    setShowFreeTourCompletionHint(false);
    setShowPostQuestionsCompletionHint(false);
    setRobotLeadTargetQuestionsActive(false);
    targetQuestionSequenceStartedRef.current = false;
    targetAnswerSubmittedRef.current = false;

    resetRoomTourProgress({
      participantId: identity.participantId,
      participantCode: identity.participantCode,
      sessionId: identity.sessionId
    }).catch((error) => {
      setFeedback(
        error.message || "The Room Tour progress could not be reset for this page load."
      );
    });
  }, [identity]);

  function startInteraction() {
    setFeedback("");
    setUnityStatus("");
    setInteractionStarted(true);

    window.requestAnimationFrame(() => {
      sendUnityCommand({
        type: "start_room_tour_intro"
      }, ROOM_TOUR_UNITY_COMMAND_TARGET);
    });
  }

  async function handleRoomTourDecision(result) {
    const decision = result.decision || {};

    syncProgressFromDecision(decision);

    if (roomTourPhase === "target_answer") {
      handleTargetQuestionDecision(decision);
      return;
    }

    if (
      roomTourPhase === "post_questions" ||
      roomTourPhase === "additional_followup"
    ) {
      await handlePreferenceFollowupDecision(decision);
      return;
    }

    if (decision.isComplete || decision.intent === "complete_room_tour_introduction") {
      startTargetQuestionSequence(decision);
      setFeedback("");
      return;
    }

    const isRecordableExplanation =
      decision.approved ||
      decision.intent === "record_room_tour_item" ||
      decision.intent === "record_room_tour_detail";
    const isFirstRecordableExplanation =
      isRecordableExplanation && recordedItems.length === 0;

    setRobotSpeaking(true);
    sendUnityCommand(
      getConfirmationCommand(decision, isFirstRecordableExplanation),
      ROOM_TOUR_UNITY_COMMAND_TARGET
    );

    if (isRecordableExplanation && decision.summary) {
      setShowFreeTourCompletionHint(true);
      setRecordedItems((currentItems) =>
        upsertRecordedItem(currentItems, {
          id: decision.matchedItemId || `unmatched_${Date.now()}`,
          summary: decision.summary,
          matched: Boolean(decision.matchedItemId)
        })
      );
    }

    if (!isRecordableExplanation) {
      setShowFreeTourCompletionHint(true);
    }

    setFeedback(decision.feedback || "");
  }

  async function completeRoomTourSession() {
    if (completionSubmittedRef.current) {
      setFinalCompleted(true);
      return;
    }

    try {
      await submitRoomTourCompletion({
        participantId: identity?.participantId,
        participantCode: identity?.participantCode,
        sessionId: identity?.sessionId,
        submittedAtBrowser: new Date().toISOString(),
        recordedItems,
        coveredItemIds,
        targetAnsweredItemIds,
        targetItemsStatus: getRoomTourItemsStatus(coveredItemIds),
        roomTourCondition,
        metadata: {
          roomTourPhase,
          roomTourCondition,
          finalPromptCompleted: true,
          targetQuestionItemsStatus: getTargetQuestionItemsStatus(targetAnsweredItemIds)
        }
      });

      completionSubmittedRef.current = true;
      setFinalCompleted(true);
      sendUnityCommand({
        type: "complete_room_tour_session",
        speechId: "room_tour_session_complete"
      }, ROOM_TOUR_UNITY_COMMAND_TARGET);
    } catch (error) {
      setFeedback(
        error.message || "Room Tour completion could not be saved. Please try again."
      );
    }
  }

  async function completeFalseRoomTourCondition() {
    if (completionSubmittedRef.current) {
      setFinalCompleted(true);
      return;
    }

    try {
      await submitRoomTourCompletion({
        participantId: identity?.participantId,
        participantCode: identity?.participantCode,
        sessionId: identity?.sessionId,
        submittedAtBrowser: new Date().toISOString(),
        recordedItems: [],
        coveredItemIds: [],
        targetAnsweredItemIds: [],
        targetItemsStatus: getRoomTourItemsStatus([]),
        roomTourCondition,
        metadata: {
          roomTourPhase: "false_condition",
          roomTourCondition,
          finalPromptCompleted: true,
          skippedRoomTour: true
        }
      });

      completionSubmittedRef.current = true;
      setFinalCompleted(true);
    } catch (error) {
      setFeedback(
        error.message || "Room Tour completion could not be saved. Please try again."
      );
    }
  }

  async function handlePreferenceFollowupDecision(decision) {
    if (decision.isComplete || decision.intent === "complete_room_tour_introduction") {
      if (
        isRobotLeadCondition(roomTourCondition) &&
        roomTourPhase === "post_questions"
      ) {
        setFeedback("");
        setRobotLeadTargetQuestionsActive(false);
        setRobotSpeaking(true);
        setRoomTourPhase("target_transition");
        sendUnityCommand({
          type: "start_room_tour_additional_followup",
          speechId: "room_tour_additional_followup_start"
        }, ROOM_TOUR_UNITY_COMMAND_TARGET);
        return;
      }

      setFeedback("");
      await completeRoomTourSession();
      return;
    }

    if (decision.intent === "record_room_tour_preference") {
      const isFirstPreferenceResponse = preferenceResponseCount === 0;

      if (decision.summary) {
        setRecordedItems((currentItems) =>
          upsertRecordedItem(currentItems, {
            id: decision.matchedItemId || `preference_${Date.now()}`,
            summary: decision.summary,
            matched: Boolean(decision.matchedItemId)
          })
        );
      }

      setPreferenceResponseCount((currentCount) => currentCount + 1);
      setShowPostQuestionsCompletionHint(true);
      setRobotSpeaking(true);
      sendUnityCommand({
        type: isFirstPreferenceResponse
          ? "play_first_preference_confirmation"
          : "play_random_confirmation",
        speechId: isFirstPreferenceResponse
          ? "room_tour_first_preference_confirmation"
          : "room_tour_preference_confirmation"
      }, ROOM_TOUR_UNITY_COMMAND_TARGET);
      setFeedback("");
      return;
    }

    setShowPostQuestionsCompletionHint(true);
    setRobotSpeaking(true);
    sendUnityCommand({
      type: "play_preference_unrelated_confirmation",
      speechId: "room_tour_preference_unrelated_confirmation"
    }, ROOM_TOUR_UNITY_COMMAND_TARGET);
    setFeedback(decision.feedback || "");
  }

  function handleTargetQuestionDecision(decision) {
    if (targetAnswerSubmittedRef.current) {
      return;
    }

    const targetItemId = Number(decision.targetItemId || currentTargetItemId);

    if (decision.approved || decision.intent === "answer_room_tour_target_question") {
      targetAnswerSubmittedRef.current = true;
      const nextTargetAnsweredItemIds = Array.from(
        new Set([...targetAnsweredItemIds, targetItemId])
      ).sort((a, b) => a - b);
      const hasAnsweredAllTargetQuestions = TARGET_ROOM_TOUR_ITEMS.every((item) =>
        nextTargetAnsweredItemIds.includes(item.id)
      );

      if (
        isRobotLeadCondition(roomTourCondition) &&
        hasAnsweredAllTargetQuestions
      ) {
        setRobotLeadTargetQuestionsActive(false);
      }

      if (decision.summary) {
        setRecordedItems((currentItems) =>
          upsertRecordedItem(currentItems, {
            id: targetItemId,
            summary: decision.summary,
            matched: true
          })
        );
      }

      setTargetAnsweredItemIds(nextTargetAnsweredItemIds);
      setCurrentTargetItemId(null);
      setRoomTourPhase("target_transition");
      setFeedback("");
      sendUnityCommand({
        type: "room_tour_target_answer_accepted",
        targetItemId,
        speechId: `room_tour_target_${targetItemId}_accepted`
      }, ROOM_TOUR_UNITY_COMMAND_TARGET);
      return;
    }

    targetAnswerSubmittedRef.current = true;
    setCurrentTargetItemId(targetItemId);
    setRoomTourPhase("target_transition");
    setFeedback(decision.feedback || "");
    sendUnityCommand({
      type: "room_tour_target_answer_rejected",
      targetItemId,
      speechId: `room_tour_target_${targetItemId}_retry`
    }, ROOM_TOUR_UNITY_COMMAND_TARGET);
  }

  function startTargetQuestionSequence(decision) {
    if (targetQuestionSequenceStartedRef.current) {
      return;
    }

    targetQuestionSequenceStartedRef.current = true;

    const nextCoveredItemIds = normalizeIdList(
      decision.coveredItemIds?.length ? decision.coveredItemIds : coveredItemIds
    );
    const nextTargetAnsweredItemIds = TARGET_ROOM_TOUR_ITEMS
      .filter((item) => nextCoveredItemIds.includes(item.id))
      .map((item) => item.id);
    const command = TARGET_ROOM_TOUR_ITEMS.reduce(
      (payload, item) => ({
        ...payload,
        [item.commandKey]: nextCoveredItemIds.includes(item.id)
      }),
      {
        type: "start_room_tour_target_questions",
        speechId: "room_tour_target_questions_start"
      }
    );

    setCoveredItemIds(nextCoveredItemIds);
    setTargetAnsweredItemIds(nextTargetAnsweredItemIds);
    setCurrentTargetItemId(null);
    setRoomTourPhase("target_transition");
    sendUnityCommand(command, ROOM_TOUR_UNITY_COMMAND_TARGET);
  }

  function syncProgressFromDecision(decision) {
    if (Array.isArray(decision.coveredItemIds)) {
      setCoveredItemIds(normalizeIdList(decision.coveredItemIds));
    }

    if (Array.isArray(decision.answeredTargetItemIds)) {
      setTargetAnsweredItemIds(normalizeIdList(decision.answeredTargetItemIds));
    }
  }

  const voiceContext = withIdentity(
    {
      phase: "phase_2_room_tour",
      flowStep:
        roomTourPhase === "target_answer"
          ? "room_tour_target_answer"
          : roomTourPhase === "post_questions" ||
              roomTourPhase === "additional_followup"
            ? "room_tour_preference_followup"
            : "room_tour_explanation",
      targetItemId: currentTargetItemId || "",
      targetItemLabel: getTargetItemLabel(currentTargetItemId)
    },
    identity
  );
  const voicePaused =
    finalCompleted ||
    robotSpeaking ||
    roomTourPhase === "target_transition" ||
    (roomTourPhase === "target_answer" && !currentTargetItemId);
  const voicePausedMessage =
    robotSpeaking || roomTourPhase === "target_transition"
      ? "Please wait while the robot is speaking."
      : "";

  if (finalCompleted) {
    return (
      <section
        className="environment-intro-page"
        aria-label="Room Tour complete"
      >
        <div className="environment-complete-panel panel">
          <h1>Room Tour Complete</h1>
          <p>
            Congratulations, you have completed the room tour for the robot.
            Let us move to the next scene.
          </p>
          <div className="environment-intro-actions">
            <button className="primary-action" type="button" onClick={onComplete}>
              Continue
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="room-tour-page" aria-label="Room Tour experiment">
      <UnityContainer
        sceneStarted={interactionStarted}
        sceneTitle="Room Tour Scene"
        unityConfig={unityConfig}
        unityLoaderUrl={unityLoaderUrl}
        onReady={handleUnityReady}
        sceneOverlay={
          introCompleted && !finalCompleted ? (
            <section className="room-tour-record-panel room-tour-record-overlay" aria-live="polite">
              {isRobotLeadCondition(roomTourCondition) &&
              robotLeadTargetQuestionsActive ? (
                <h2>
                  Listen to the robot's question and answer using voice input.
                  The robot has currently recorded:
                </h2>
              ) : (
                <h2>
                  Walk to any object you think the robot should know about and
                  introduce one object or detail at a time using voice input.
                  After each one, stop speaking by clicking the Stop Input and
                  Send button so it can be recorded before continuing. The
                  robot has currently recorded:
                </h2>
              )}
              <p>
                {recordedItems.length > 0
                  ? recordedItems
                      .map((item) => item.summary)
                      .join("; ")
                  : "No room details recorded yet."}
              </p>
            </section>
          ) : null
        }
        preStartOverlay={
          <div className="scene-cover room-tour-start-cover">
            <p>Room Tour</p>
            <h3>
              <span>Begin the room tour interaction</span>
              <span>when you are ready.</span>
            </h3>
            <button
              className="primary-action room-tour-start-button"
              type="button"
              onClick={startInteraction}
              disabled={!unityLoaded || !sceneReady}
            >
              {unityLoaded && sceneReady ? (
                "Start Interaction"
              ) : (
                <>
                  <span className="button-spinner" aria-hidden="true" />
                  Loading Room Tour Scene
                </>
              )}
            </button>
            <span className="room-tour-start-hint">
              {unityLoaded && sceneReady
                ? "The room tour scene is ready. Click Start Interaction to begin."
                : "Please wait for the room tour scene to finish loading. You can start once the button is enabled."}
            </span>
            {unityStatus ? <span className="room-tour-unity-status">{unityStatus}</span> : null}
          </div>
        }
      >
        {unityStatus && !introCompleted ? (
          <p className="room-tour-unity-inline-status">{unityStatus}</p>
        ) : null}

        {introCompleted && !finalCompleted ? (
          <>
            <VoiceRecorder
              context={voiceContext}
              disabled={voicePaused}
              disabledMessage={voicePausedMessage}
              feedback={feedback}
              buttonHint={
                roomTourPhase === "target_answer" && currentTargetItemId
                  ? `Answer: ${getTargetQuestionAnswer(currentTargetItemId)}`
                  : (roomTourPhase === "free_tour" &&
                  (recordedItems.length > 0 || showFreeTourCompletionHint)) ||
                ((roomTourPhase === "post_questions" ||
                  roomTourPhase === "additional_followup") &&
                  showPostQuestionsCompletionHint)
                  ? `If you have finished introducing the room, you can say, "That's everything I wanted to introduce."`
                  : ""
              }
              onDecision={handleRoomTourDecision}
            />
          </>
        ) : null}
      </UnityContainer>
    </section>
  );
}

function normalizeIdList(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value))
    )
  ).sort((a, b) => a - b);
}

function getTargetItemLabel(itemId) {
  return TARGET_ROOM_TOUR_ITEMS.find((item) => item.id === Number(itemId))?.label || "";
}

function getTargetQuestionAnswer(itemId) {
  return TARGET_ROOM_TOUR_ANSWERS[Number(itemId)] || "";
}

function getRoomTourItemsStatus(coveredItemIds) {
  const coveredIds = new Set(normalizeIdList(coveredItemIds));

  return ROOM_TOUR_ITEMS.reduce((status, item) => ({
    ...status,
    [item.label]: coveredIds.has(item.id)
  }), {});
}

function getTargetQuestionItemsStatus(answeredItemIds) {
  const answeredIds = new Set(normalizeIdList(answeredItemIds));

  return TARGET_ROOM_TOUR_ITEMS.reduce((status, item) => ({
    ...status,
    [item.label]: answeredIds.has(item.id)
  }), {});
}

function getConfirmationCommand(decision, isFirstRecordableExplanation) {
  const isRecordableExplanation =
    decision.approved ||
    decision.intent === "record_room_tour_item" ||
    decision.intent === "record_room_tour_detail";

  if (!isRecordableExplanation) {
    return {
      type: "play_unrelated_explanation_confirmation",
      speechId: "room_tour_unrelated_explanation_confirmation"
    };
  }

  if (isFirstRecordableExplanation) {
    return {
      type: "play_first_explanation_confirmation",
      speechId: "room_tour_first_explanation_confirmation"
    };
  }

  return {
    type: "play_random_confirmation",
    speechId: "room_tour_confirmation"
  };
}

function normalizeUnityEvent(detail) {
  if (typeof detail !== "string") {
    return detail;
  }

  try {
    return JSON.parse(detail);
  } catch {
    return {
      type: "unknown",
      raw: detail
    };
  }
}

function withIdentity(context, identity) {
  if (!identity) {
    return context;
  }

  return {
    ...context,
    participantId: identity.participantId,
    participantCode: identity.participantCode,
    sessionId: identity.sessionId,
    roomTourCondition: identity.roomTourCondition,
    taskResponseCondition: identity.taskResponseCondition
  };
}

function upsertRecordedItem(items, nextItem) {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id);

  if (existingIndex >= 0) {
    return items.map((item, index) =>
      index === existingIndex ? { ...item, ...nextItem } : item
    );
  }

  const duplicateSummaryIndex = items.findIndex((item) =>
    areRecordedSummariesSimilar(item.summary, nextItem.summary)
  );

  if (duplicateSummaryIndex >= 0) {
    return items.map((item, index) => {
      if (index !== duplicateSummaryIndex) {
        return item;
      }

      if (nextItem.matched && !item.matched) {
        return { ...item, ...nextItem };
      }

      return item;
    });
  }

  return [...items, nextItem];
}

function areRecordedSummariesSimilar(firstSummary, secondSummary) {
  const first = normalizeRecordedSummary(firstSummary);
  const second = normalizeRecordedSummary(secondSummary);

  if (!first || !second) {
    return false;
  }

  if (first === second || first.includes(second) || second.includes(first)) {
    return true;
  }

  const firstTokens = new Set(first.split(" ").filter(Boolean));
  const secondTokens = new Set(second.split(" ").filter(Boolean));
  const sharedTokenCount = Array.from(firstTokens).filter((token) =>
    secondTokens.has(token)
  ).length;
  const smallerTokenCount = Math.min(firstTokens.size, secondTokens.size);

  return smallerTokenCount >= 3 && sharedTokenCount / smallerTokenCount >= 0.8;
}

function normalizeRecordedSummary(summary) {
  return String(summary || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|this|that|these|those)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
