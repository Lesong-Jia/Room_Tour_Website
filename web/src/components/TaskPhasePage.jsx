import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadTaskPhaseClarifications,
  markTaskPhaseClarification,
  submitTaskPhaseTrialResult
} from "../experiment/api.js";
import { sendUnityCommand } from "../experiment/unityBridge.js";
import UnityContainer from "./UnityContainer.jsx";
import VoiceRecorder from "./VoiceRecorder.jsx";

const TASK_PHASE_UNITY_COMMAND_TARGET = {
  objectName: "Progress_Manager",
  methodName: "HandleHostCommand"
};

const TASK_INSTRUCTIONS = {
  making_coffee: 'Please ask the robot to "make you a cup of coffee."',
  can_meat: 'Please ask the robot to "prepare a can of tuna for you."',
  chopping_vegetables: 'Please ask the robot to "slice a carrot for you."',
  heating_food_microwave:
    'Please ask the robot to "heat the food on the stove with the microwave."',
  pick_up_trash:
    'Please ask the robot to "throw the trash on the table into the trash can."',
  boxing_books:
    'Please ask the robot to "put away the books on the sofa that you have already finished reading."',
  clean_tv: 'Please ask the robot to "clean the TV screen."',
  light_candle: 'Please ask the robot to "light the scented candle."',

  turn_on_work_table_light:
    'Please ask the robot to "turn on the light on the work table."',
  hang_up_paint:
    'Please ask the robot to "hang up the painting on the work table."',
  pick_laptop_to_work_table:
    'Please ask the robot to "pick the laptop to the work table."',
  place_vase_top_shelf:
    'Please ask the robot to "place the antique vase on the second shelf from the top."',

  sort_tools_to_toolbox:
    'Please ask the robot to "put the tools into the toolbox."',
  put_leftovers_in_fridge:
    'Please ask the robot to "put the leftovers on the table in the fridge."',
  replace_floor_lamp_bulb:
    'Please ask the robot to "replace the light bulb in the work table lamp."',
  spray_insecticide_houseplant:
    'Please ask the robot to "spray some insecticide on the plant on the coffee table."'
};

const CLARIFICATION_HINTS = {
  making_coffee: 'You can say: "Use the gray mug."',
  can_meat: 'You can say: "Use the plate."',
  chopping_vegetables: 'You can say: "Use the small cutting board."',
  heating_food_microwave: 'You can say: "Use the white one."',
  pick_up_trash: 'You can say: "Put the recyclable trash in the white one."',
  boxing_books: 'You can say: "Put the books in the bottom storage box."',
  clean_tv: 'You can say: "Use the green one."',
  light_candle: 'You can say: "The scented candle is the green one."'
};

const FIXED_TASK_RESULTS = {
  making_coffee: "The robot successfully made a cup of coffee.",
  can_meat: "The robot successfully prepared a can of tuna.",
  chopping_vegetables: "The robot successfully sliced the carrot.",
  heating_food_microwave:
    "The robot successfully heated the food on the stove with the microwave.",
  pick_up_trash:
    "The robot successfully threw the trash on the table into the trash can.",
  boxing_books: "The robot successfully put away the books on the sofa.",
  clean_tv: "The robot successfully cleaned the TV screen.",
  light_candle: "The robot successfully lit the scented candle."
};

const RANDOM_TASK_RESULTS = {
  turn_on_work_table_light: {
    success: "The robot successfully turned on the light on the work table.",
    failure:
      "The robot misunderstood your instruction and turned all the lights off instead of turning on the light on the work table. The task failed."
  },
  hang_up_paint: {
    success: "The robot successfully hung up the painting on the work table.",
    failure:
      "The robot misunderstood your instruction and only held up the painting instead of hanging it up. The task failed."
  },
  pick_laptop_to_work_table: {
    success: "The robot successfully put the laptop on the work table.",
    failure:
      'The robot misunderstood "pick to" as "pick from," so it did not find the laptop on the work table. The task failed.'
  },
  place_vase_top_shelf: {
    success:
      "The robot successfully placed the antique vase on the second shelf from the top.",
    failure:
      "The robot misunderstood the second shelf from the top as the second shelf from the bottom. Since there was no empty space on that shelf, the task failed."
  },
  sort_tools_to_toolbox: {
    success: "The robot successfully put the tools into the toolbox.",
    failure:
      'The robot misunderstood "to the toolbox" as "next to the toolbox," so it only placed the tools next to the toolbox. The task failed.'
  },
  put_leftovers_in_fridge: {
    success: "The robot successfully put the leftovers in the fridge.",
    failure:
      "The robot misunderstood the fridge as the freezer, so it put the leftovers in the freezer. The task failed."
  },
  replace_floor_lamp_bulb: {
    success:
      "The robot successfully replaced the light bulb in the work table lamp.",
    failure:
      'The robot misunderstood "replace" as "remove," so it only removed the light bulb and did not install a new one. The task failed.'
  },
  spray_insecticide_houseplant: {
    success:
      "The robot successfully sprayed insecticide on the plant on the coffee table.",
    failure:
      "The robot did not understand the instruction clearly and thought it should water the plant, so it used the water spray bottle. The task failed."
  }
};

const LIKERT_ITEMS = [
  {
    id: "difficulty",
    label: "How difficult would this task be for a robot to perform?"
  },
  {
    id: "danger",
    label: "How dangerous would this task be for a robot to perform?"
  },
  {
    id: "experience",
    label: "How was your interaction experience with the robot in this task?"
  },
  {
    id: "trust",
    label: "How much do you trust this robot after this task?"
  }
];

const INITIAL_RATINGS = {
  difficulty: "",
  danger: "",
  experience: "",
  trust: ""
};

export default function TaskPhasePage({
  identity,
  onComplete,
  phase = "phase_2_task_phase",
  sceneLabel = "Task Phase",
  unityBasePath = "/unity/Ex_Stage_1",
  unityFilePrefix = "Ex_Stage_1"
}) {
  const [unityLoaded, setUnityLoaded] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [interactionStarted, setInteractionStarted] = useState(false);
  const [taskPhase, setTaskPhase] = useState("idle");
  const [currentTask, setCurrentTask] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [unityStatus, setUnityStatus] = useState("");
  const [lastOutcome, setLastOutcome] = useState(null);
  const [ratings, setRatings] = useState(INITIAL_RATINGS);
  const [ratingError, setRatingError] = useState("");
  const [clarifiedTasks, setClarifiedTasks] = useState({});
  const [completed, setCompleted] = useState(false);
  const completedTasksRef = useRef([]);

  const unityConfig = useMemo(
    () => ({
      arguments: [],
      dataUrl: `${unityBasePath}/Build/${unityFilePrefix}.data.br`,
      frameworkUrl: `${unityBasePath}/Build/${unityFilePrefix}.framework.js.br`,
      codeUrl: `${unityBasePath}/Build/${unityFilePrefix}.wasm.br`,
      streamingAssetsUrl: `${unityBasePath}/StreamingAssets`,
      devicePixelRatio: 1,
      companyName: "DefaultCompany",
      productName: "Task_Phase",
      productVersion: "0.1"
    }),
    [unityBasePath, unityFilePrefix]
  );
  const unityLoaderUrl = `${unityBasePath}/Build/${unityFilePrefix}.loader.js`;

  const handleUnityReady = useCallback(() => {
    setUnityLoaded(true);
  }, []);

  useEffect(() => {
    function handleUnityEvent(event) {
      const detail = normalizeUnityEvent(event.detail);

      if (detail?.type === "task_phase_scene_ready") {
        setSceneReady(true);
        setUnityStatus("");
      }

      if (detail?.type === "task_instruction_ready") {
        setCurrentTask(toTaskState(detail));
        setTaskPhase("instruction");
        setFeedback("");
        setRatingError("");
        setRatings(INITIAL_RATINGS);
      }

      if (detail?.type === "task_start_reply_ready") {
        setCurrentTask((task) => ({ ...task, ...toTaskState(detail) }));
        setTaskPhase("start_reply");
        setFeedback("");
      }

      if (detail?.type === "task_clarification_ready") {
        setCurrentTask((task) => ({ ...task, ...toTaskState(detail) }));
        setTaskPhase("clarification");
        setFeedback("");
      }

      if (detail?.type === "task_clarification_rejected") {
        setTaskPhase("clarification");
        setFeedback(CLARIFICATION_HINTS[detail.taskId] || "");
      }

      if (detail?.type === "task_completed") {
        const task = toTaskState(detail);
        setCurrentTask(task);
        setTaskPhase("questionnaire");
        setFeedback("");
        setLastOutcome((currentOutcome) =>
          currentOutcome?.taskId === task.taskId
            ? currentOutcome
            : getDefaultOutcome(task)
        );
      }

      if (detail?.type === "task_phase_completed") {
        setCompleted(true);
        setTaskPhase("completed");
        setFeedback("");
        onComplete?.();
      }

      if (detail?.type === "task_phase_error") {
        setUnityStatus(detail.message || "Unity reported a task phase error.");
      }
    }

    window.addEventListener("unity-experiment-event", handleUnityEvent);

    return () => {
      window.removeEventListener("unity-experiment-event", handleUnityEvent);
    };
  }, [onComplete]);

  useEffect(() => {
    if (!identity?.sessionId) {
      return;
    }

    let canceled = false;

    loadTaskPhaseClarifications({
      participantId: identity.participantId,
      participantCode: identity.participantCode,
      sessionId: identity.sessionId
    })
      .then((result) => {
        if (!canceled) {
          setClarifiedTasks(result.clarifiedTasks || {});
          writeStoredClarifications(result.clarifiedTasks || {});
        }
      })
      .catch((error) => {
        if (!canceled) {
          setFeedback(
            error.message || "Could not load prior clarification status."
          );
        }
      });

    return () => {
      canceled = true;
    };
  }, [identity]);

  function startTaskPhase() {
    setInteractionStarted(true);
    setTaskPhase("loading_task");
    setUnityStatus("");
    setFeedback("");

    window.requestAnimationFrame(() => {
      sendUnityCommand({ type: "start_task_phase" }, TASK_PHASE_UNITY_COMMAND_TARGET);
    });
  }

  function handleTaskDecision(result) {
    const decision = result.decision || {};

    if (decision.flowStep === "task_phase_instruction") {
      if (decision.approved && decision.unityCommand) {
        if (decision.includesClarificationAnswer) {
          markClarifiedTask(decision.taskId || currentTask?.taskId, "initial_instruction");
        }

        setFeedback("");
        setTaskPhase("robot_response");
        sendUnityCommand(decision.unityCommand, TASK_PHASE_UNITY_COMMAND_TARGET);
        return;
      }

      setFeedback(decision.feedback || getInstructionRetryMessage());
      sendUnityCommand(
        { type: "task_instruction_rejected" },
        TASK_PHASE_UNITY_COMMAND_TARGET
      );
      return;
    }

    if (decision.flowStep === "task_phase_start_reply") {
      if (decision.unityCommand) {
        setFeedback("");
        setTaskPhase("robot_response");
        setLastOutcome(getOutcomeForStartReply(currentTask, decision.answer));
        sendUnityCommand(decision.unityCommand, TASK_PHASE_UNITY_COMMAND_TARGET);
        return;
      }

      setFeedback(decision.feedback || "Please answer yes or no.");
      return;
    }

    if (decision.flowStep === "task_phase_clarification_answer") {
      if (decision.approved && decision.unityCommand) {
        markClarifiedTask(decision.taskId || currentTask?.taskId, "clarification_answer");
        setFeedback("");
        setTaskPhase("robot_response");
        sendUnityCommand(decision.unityCommand, TASK_PHASE_UNITY_COMMAND_TARGET);
        return;
      }

      setFeedback(CLARIFICATION_HINTS[currentTask?.taskId] || decision.feedback || "");
      sendUnityCommand(
        { type: "task_clarification_answer_rejected" },
        TASK_PHASE_UNITY_COMMAND_TARGET
      );
    }
  }

  function markClarifiedTask(taskId, source) {
    if (!taskId || !identity?.participantId || !identity?.sessionId) {
      return;
    }

    setClarifiedTasks((currentTasks) => {
      const nextTasks = {
        ...currentTasks,
        [taskId]: true
      };
      writeStoredClarifications(nextTasks);
      return nextTasks;
    });

    markTaskPhaseClarification({
      participantId: identity.participantId,
      participantCode: identity.participantCode,
      sessionId: identity.sessionId,
      taskId,
      clarified: true,
      source,
      submittedAtBrowser: new Date().toISOString()
    }).catch((error) => {
      setFeedback(
        error.message || "Could not save clarification status for this task."
      );
    });
  }

  async function submitTaskQuestionnaire(event) {
    event.preventDefault();

    if (LIKERT_ITEMS.some((item) => !ratings[item.id])) {
      setRatingError("Please answer all four ratings before continuing.");
      return;
    }

    try {
      const completedAtBrowser = new Date().toISOString();
      const resultPayload = {
        participantId: identity?.participantId,
        participantCode: identity?.participantCode,
        sessionId: identity?.sessionId,
        taskId: currentTask?.taskId,
        taskIndex: currentTask?.taskIndex,
        taskCount: currentTask?.taskCount,
        condition: currentTask?.condition || "",
        phase,
        outcome: lastOutcome?.outcome || getDefaultOutcome(currentTask).outcome,
        ratings,
        submittedAtBrowser: completedAtBrowser,
        metadata: {
          phase
        }
      };

      await submitTaskPhaseTrialResult(resultPayload);

      completedTasksRef.current = [
        ...completedTasksRef.current,
        {
          ...resultPayload,
          completedAtBrowser
        }
      ];

      setRatings({ ...INITIAL_RATINGS });
      setRatingError("");
      setLastOutcome(null);
      setTaskPhase("loading_task");
      sendUnityCommand(
        { type: "continue_after_task_questionnaire" },
        TASK_PHASE_UNITY_COMMAND_TARGET
      );
    } catch (error) {
      setRatingError(
        error.message || "This task result could not be saved. Please try again."
      );
    }
  }

  const voiceContext = withIdentity(
    {
      phase,
      flowStep: getVoiceFlowStep(taskPhase),
      taskId: currentTask?.taskId || "",
      condition: currentTask?.condition || "",
      clarificationAlreadyAnswered:
        clarifiedTasks[currentTask?.taskId] === true ||
        getStoredClarificationAnswered(currentTask?.taskId)
    },
    identity
  );
  const voiceEnabled = ["instruction", "start_reply", "clarification"].includes(taskPhase);
  const overlay = getTaskOverlay({
    taskPhase,
    currentTask,
    lastOutcome,
    ratings,
    ratingError,
    setRatings,
    submitTaskQuestionnaire
  });

  return (
    <section className="task-phase-page" aria-label="Task phase experiment">
      <UnityContainer
        sceneStarted={interactionStarted}
        sceneTitle="Task Phase Scene"
        unityConfig={unityConfig}
        unityLoaderUrl={unityLoaderUrl}
        onReady={handleUnityReady}
        sceneOverlay={overlay}
        completionOverlay={
          completed ? (
            <div className="completion-cover task-phase-completion-cover">
              <p>You have completed this part of the experiment.</p>
            </div>
          ) : null
        }
        preStartOverlay={
          <div className="scene-cover room-tour-start-cover task-phase-start-cover">
            <p>{sceneLabel}</p>
            <h3>
              <span>Begin the robot task interaction</span>
              <span>when you are ready.</span>
            </h3>
            <button
              className="primary-action room-tour-start-button task-phase-start-button"
              type="button"
              onClick={startTaskPhase}
              disabled={!unityLoaded || !sceneReady}
            >
              {unityLoaded && sceneReady ? (
                "Start Tasks"
              ) : (
                <>
                  <span className="button-spinner" aria-hidden="true" />
                  Loading Task Scene
                </>
              )}
            </button>
            <span className="room-tour-start-hint">
              {unityLoaded && sceneReady
                ? "The task scene is ready. Click Start Tasks to begin."
                : "Please wait for the task scene to finish loading. You can start once the button is enabled."}
            </span>
            {unityStatus ? <span className="room-tour-unity-status">{unityStatus}</span> : null}
          </div>
        }
      >
        {unityStatus && interactionStarted ? (
          <p className="room-tour-unity-inline-status">{unityStatus}</p>
        ) : null}

        {interactionStarted && !completed ? (
          <VoiceRecorder
            context={voiceContext}
            disabled={!voiceEnabled}
            disabledMessage={getVoicePausedMessage(taskPhase)}
            feedback={feedback}
            onDecision={handleTaskDecision}
          />
        ) : null}
      </UnityContainer>
    </section>
  );
}

function getTaskOverlay({
  taskPhase,
  currentTask,
  lastOutcome,
  ratings,
  ratingError,
  setRatings,
  submitTaskQuestionnaire
}) {
  if (taskPhase === "instruction") {
    return (
      <section className="task-phase-overlay task-phase-instruction-overlay">
        <span className="task-phase-count">{getTaskCountLabel(currentTask)}</span>
        <h2>{getInstructionText(currentTask?.taskId)}</h2>
      </section>
    );
  }

  if (taskPhase === "start_reply") {
    return (
      <section className="task-phase-overlay task-phase-prompt-overlay">
        <span className="task-phase-count">{getTaskCountLabel(currentTask)}</span>
        <h2>Please answer the robot&apos;s question.</h2>
        <p>Answer yes or no using the voice input below.</p>
      </section>
    );
  }

  if (taskPhase === "clarification") {
    return (
      <section className="task-phase-overlay task-phase-prompt-overlay">
        <span className="task-phase-count">{getTaskCountLabel(currentTask)}</span>
        <h2>Please answer the robot&apos;s question.</h2>
        <p className="task-phase-hint">
          {CLARIFICATION_HINTS[currentTask?.taskId] ||
            "Use the highlighted hint if the robot asks for clarification."}
        </p>
      </section>
    );
  }

  if (taskPhase === "questionnaire") {
    return (
      <form className="task-phase-questionnaire-overlay" onSubmit={submitTaskQuestionnaire}>
        <span className="task-phase-count">{getTaskCountLabel(currentTask)}</span>
        <h2 className={`task-phase-result ${getResultTone(currentTask, lastOutcome)}`}>
          {getResultText(currentTask, lastOutcome)}
        </h2>
        <p className="task-phase-questionnaire-instruction">
          Please answer the following questions based on your experience with this task.
        </p>
        <div className="task-phase-likert-list">
          {LIKERT_ITEMS.map((item) => (
            <fieldset className="task-phase-likert-item" key={item.id}>
              <legend>{item.label}</legend>
              <div className="task-phase-likert-options">
                {[1, 2, 3, 4, 5].map((value) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name={item.id}
                      value={value}
                      checked={ratings[item.id] === String(value)}
                      onChange={(event) =>
                        setRatings((currentRatings) => ({
                          ...currentRatings,
                          [item.id]: event.target.value
                        }))
                      }
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        {ratingError ? <p className="error-message">{ratingError}</p> : null}
        <button className="primary-action task-phase-continue-button" type="submit">
          Continue
        </button>
      </form>
    );
  }

  return null;
}

function getVoiceFlowStep(taskPhase) {
  if (taskPhase === "start_reply") {
    return "task_phase_start_reply";
  }

  if (taskPhase === "clarification") {
    return "task_phase_clarification_answer";
  }

  return "task_phase_instruction";
}

function getVoicePausedMessage(taskPhase) {
  if (taskPhase === "robot_response" || taskPhase === "loading_task") {
    return "Please wait while the robot responds.";
  }

  if (taskPhase === "questionnaire") {
    return "Please complete the questionnaire above.";
  }

  return "";
}

function getInstructionRetryMessage() {
  return "Please follow the instruction shown above and ask the robot using the quoted task phrase.";
}

function getInstructionText(taskId) {
  const normalizedTaskId = normalizeTaskId(taskId);
  return TASK_INSTRUCTIONS[normalizedTaskId] ||
    `Task prompt missing for taskId: ${taskId || "empty"}. Please check the Unity taskId.`;
}

function getTaskCountLabel(task) {
  if (!task?.taskIndex || !task?.taskCount) {
    return "";
  }

  return `Task ${task.taskIndex} of ${task.taskCount}`;
}

function getResultText(task, outcome) {
  if (!task?.condition) {
    return FIXED_TASK_RESULTS[task?.taskId] || "The robot completed the task.";
  }

  const result = RANDOM_TASK_RESULTS[task.taskId];
  return result?.[outcome?.outcome || "failure"] || "The robot completed the task.";
}

function getResultTone(task, outcome) {
  if (!task?.condition) {
    return "success";
  }

  return outcome?.outcome === "success" ? "success" : "failure";
}

function getOutcomeForStartReply(task, answer) {
  if (!task?.condition) {
    return { taskId: task?.taskId, outcome: "success" };
  }

  const saidYes = answer === "yes";
  const askedCorrect =
    task.condition === "believes_wrong_actually_correct";
  const success = askedCorrect ? saidYes : !saidYes;

  return {
    taskId: task.taskId,
    condition: task.condition,
    outcome: success ? "success" : "failure"
  };
}

function getDefaultOutcome(task) {
  if (!task?.condition) {
    return { taskId: task?.taskId, outcome: "success" };
  }

  return {
    taskId: task.taskId,
    condition: task.condition,
    outcome: "failure"
  };
}

function getStoredClarificationAnswered(taskId) {
  if (!taskId || typeof window === "undefined") {
    return false;
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem("humanRobotExperiment.fixedClarifications") || "{}"
    );
    return stored[taskId] === true;
  } catch {
    return false;
  }
}

function writeStoredClarifications(clarifiedTasks) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    "humanRobotExperiment.fixedClarifications",
    JSON.stringify(clarifiedTasks || {})
  );
}

function toTaskState(detail) {
  return {
    taskId: normalizeTaskId(detail.taskId),
    condition: detail.condition || "",
    taskIndex: Number(detail.taskIndex) || 0,
    taskCount: Number(detail.taskCount) || 0
  };
}

function normalizeTaskId(taskId) {
  return String(taskId || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
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
    sessionId: identity.sessionId
  };
}
