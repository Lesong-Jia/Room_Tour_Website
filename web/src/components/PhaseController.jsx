import { useEffect, useState } from "react";
import AudioPlaybackCheck from "./AudioPlaybackCheck.jsx";
import UnityContainer from "./UnityContainer.jsx";
import VoiceRecorder from "./VoiceRecorder.jsx";

const START_SCENE_CONTEXT = {
  phase: "practice_calibration",
  flowStep: "welcome_scene_start"
};

const ROBOT_GREETING_CONTEXT = {
  phase: "practice_calibration",
  flowStep: "welcome_robot_greeting"
};

const WELCOME_PHASES = {
  WAITING_TO_START: "waiting_to_start",
  SCENE_RUNNING: "scene_running",
  WAITING_FOR_GREETING: "waiting_for_greeting",
  COMPLETE: "complete"
};

export default function PhaseController({ identity, onContinue }) {
  const [welcomePhase, setWelcomePhase] = useState(
    WELCOME_PHASES.WAITING_TO_START
  );
  const [audioCheckPassed, setAudioCheckPassed] = useState(false);
  const [sceneFeedback, setSceneFeedback] = useState("");

  const sceneStarted = welcomePhase !== WELCOME_PHASES.WAITING_TO_START;
  const shouldShowVoiceRecorder =
    (audioCheckPassed && welcomePhase === WELCOME_PHASES.WAITING_TO_START) ||
    welcomePhase === WELCOME_PHASES.WAITING_FOR_GREETING;
  const voiceContext =
    welcomePhase === WELCOME_PHASES.WAITING_FOR_GREETING
      ? withIdentity(ROBOT_GREETING_CONTEXT, identity)
      : withIdentity(START_SCENE_CONTEXT, identity);
  const completionOverlay =
    welcomePhase === WELCOME_PHASES.COMPLETE ? (
      <div className="completion-cover">
        <p>
          Thank you for completing the device calibration and welcome scene.
          Click the button below to begin the experiment.
        </p>
        <button
          className="continue-arrow-button"
          type="button"
          onClick={onContinue}
          aria-label="Continue to the experiment"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    ) : null;

  useEffect(() => {
    function handleUnityEvent(event) {
      const detail = normalizeUnityEventDetail(event.detail);

      if (detail?.type === "welcome_robot_greeting_ready") {
        setWelcomePhase((currentPhase) =>
          currentPhase === WELCOME_PHASES.SCENE_RUNNING
            ? WELCOME_PHASES.WAITING_FOR_GREETING
            : currentPhase
        );
        setSceneFeedback("");
      }
    }

    window.addEventListener("unity-experiment-event", handleUnityEvent);

    return () => {
      window.removeEventListener("unity-experiment-event", handleUnityEvent);
    };
  }, []);

  function handleVoiceDecision(result) {
    const flowStep = result.context?.flowStep || result.decision?.flowStep;

    if (result.decision?.approved && flowStep === "welcome_scene_start") {
      setWelcomePhase(WELCOME_PHASES.SCENE_RUNNING);
      setSceneFeedback("");
      return;
    }

    if (
      result.decision?.approved &&
      flowStep === "welcome_robot_greeting"
    ) {
      setWelcomePhase(WELCOME_PHASES.COMPLETE);
      setSceneFeedback("");
      return;
    }

    setSceneFeedback(
      result.decision?.feedback || getFallbackFeedback(flowStep)
    );
  }

  return (
    <section className="experiment-layout">
      <header className="panel intro-panel">
        <div className="intro-copy">
          <h1>Device Check</h1>
          <p className="centered-copy">
            Please complete the checks below before entering the experiment.
          </p>
        </div>

        <div className="scroll-cue" aria-hidden="true">
          <span />
        </div>
      </header>

      {!audioCheckPassed ? (
        <section className="panel audio-check-panel">
          <AudioPlaybackCheck onPassed={() => setAudioCheckPassed(true)} />
        </section>
      ) : (
        <UnityContainer
          sceneStarted={sceneStarted}
          completionOverlay={completionOverlay}
        >
          {shouldShowVoiceRecorder ? (
            <VoiceRecorder
              context={voiceContext}
              feedback={sceneFeedback}
              onDecision={handleVoiceDecision}
            />
          ) : null}
        </UnityContainer>
      )}
    </section>
  );
}

function getFallbackFeedback(flowStep) {
  if (flowStep === "welcome_robot_greeting") {
    return "Please use the voice input button to say hi to Aria.";
  }

  return 'Please follow the instruction and say "start the scene".';
}

function normalizeUnityEventDetail(detail) {
  if (typeof detail !== "string") {
    return detail;
  }

  try {
    return JSON.parse(detail);
  } catch {
    if (detail.includes("welcome_robot_greeting_ready")) {
      return {
        type: "welcome_robot_greeting_ready",
        raw: detail
      };
    }

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
