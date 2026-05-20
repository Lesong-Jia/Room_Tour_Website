import { useEffect, useState } from "react";
import DemographicPage from "./components/DemographicPage.jsx";
import EnvironmentIntroPage from "./components/EnvironmentIntroPage.jsx";
import ExperimentCompletePage from "./components/ExperimentCompletePage.jsx";
import PhaseController from "./components/PhaseController.jsx";
import PhaseThreeIntroPage from "./components/PhaseThreeIntroPage.jsx";
import PostInteractionQuestionnairePage from "./components/PostInteractionQuestionnairePage.jsx";
import RoomTourPage from "./components/RoomTourPage.jsx";
import TaskPhasePage from "./components/TaskPhasePage.jsx";
import {
  initializeExperimentIdentity,
  readStoredIdentity,
  updateStoredFlowStep
} from "./experiment/session.js";

const FLOW_STEP_TO_PAGE = {
  welcome: "welcome",
  practice_calibration: "welcome",
  pre_experiment_questionnaire: "demographic",
  environment_intro: "environment_intro",
  phase_2_room_tour: "room_tour",
  room_tour: "room_tour",
  next_experiment_placeholder: "next_experiment_placeholder",
  phase_2_end_questionnaire: "phase_2_end_questionnaire",
  phase_3_second_round: "phase_3_second_round",
  phase_3_task_phase: "phase_3_task_phase",
  phase_3_end_questionnaire: "phase_3_end_questionnaire",
  completion: "completion"
};

export default function App() {
  const cachedIdentity = getInitialIdentity();
  const previewFlowStep = getPreviewFlowStep();
  const [page, setPage] = useState(() =>
    getPageFromFlowStep(previewFlowStep || cachedIdentity?.currentFlowStep)
  );
  const [identity, setIdentity] = useState(cachedIdentity);
  const [identityState, setIdentityState] = useState(
    cachedIdentity ? "ready" : "loading"
  );
  const [identityError, setIdentityError] = useState("");

  useEffect(() => {
    let canceled = false;

    async function loadIdentity() {
      try {
        const nextIdentity = await initializeExperimentIdentity();

        if (canceled) {
          return;
        }

        setIdentity(nextIdentity);
        setPage(getPageFromFlowStep(previewFlowStep || nextIdentity.currentFlowStep));
        setIdentityState("ready");
      } catch (error) {
        if (!canceled) {
          setIdentityState("error");
          setIdentityError(
            error.message || "The experiment session could not be started."
          );
        }
      }
    }

    loadIdentity();

    return () => {
      canceled = true;
    };
  }, [previewFlowStep]);

  function goToPage(nextPage, nextFlowStep) {
    setPage(nextPage);

    if (nextFlowStep) {
      updateStoredFlowStep(nextFlowStep);
      setIdentity((currentIdentity) =>
        currentIdentity
          ? {
              ...currentIdentity,
              currentFlowStep: nextFlowStep
            }
          : currentIdentity
      );
    }
  }

  if (identityState === "loading") {
    return (
      <main className="app-shell">
        <section className="panel app-status-panel" role="status">
          <h1>Preparing experiment session</h1>
          <p>Please wait while the experiment creates your anonymous session.</p>
        </section>
      </main>
    );
  }

  if (identityState === "error") {
    return (
      <main className="app-shell">
        <section className="panel app-status-panel">
          <h1>Session setup failed</h1>
          <p>{identityError}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {page === "welcome" ? (
        <PhaseController
          identity={identity}
          onContinue={() =>
            goToPage("demographic", "pre_experiment_questionnaire")
          }
        />
      ) : null}

      {page === "demographic" ? (
        <DemographicPage
          identity={identity}
          onComplete={() => goToPage("environment_intro", "environment_intro")}
        />
      ) : null}

      {page === "environment_intro" ? (
        <EnvironmentIntroPage
          onContinue={() =>
            goToPage("room_tour", "phase_2_room_tour")
          }
        />
      ) : null}

      {page === "room_tour" ? (
        <RoomTourPage
          identity={identity}
          onComplete={() =>
            goToPage(
              "next_experiment_placeholder",
              "next_experiment_placeholder"
            )
          }
        />
      ) : null}

      {page === "next_experiment_placeholder" ? (
        <TaskPhasePage
          identity={identity}
          onComplete={() =>
            goToPage("phase_2_end_questionnaire", "phase_2_end_questionnaire")
          }
        />
      ) : null}

      {page === "phase_2_end_questionnaire" ? (
        <PostInteractionQuestionnairePage
          identity={identity}
          onComplete={() =>
            goToPage("phase_3_second_round", "phase_3_second_round")
          }
        />
      ) : null}

      {page === "phase_3_second_round" ? (
        <PhaseThreeIntroPage
          onContinue={() =>
            goToPage("phase_3_task_phase", "phase_3_task_phase")
          }
        />
      ) : null}

      {page === "phase_3_task_phase" ? (
        <TaskPhasePage
          identity={identity}
          phase="phase_3_task_phase"
          sceneLabel="Task Phase"
          unityBasePath="/unity/Ex_Stage_2"
          unityFilePrefix="Ex_Stage_2"
          onComplete={() =>
            goToPage("phase_3_end_questionnaire", "phase_3_end_questionnaire")
          }
        />
      ) : null}

      {page === "phase_3_end_questionnaire" ? (
        <PostInteractionQuestionnairePage
          identity={identity}
          phase="phase_3_end_questionnaire"
          questionnaireId="many_days_later_interaction_questionnaire"
          nextFlowStep="completion"
          interactionLabel="interaction with the robot many days later"
          intro={
            <p className="post-interaction-questionnaire-intro">
              Please answer the following questions based on the interaction
              between you and the robot <strong>many days later</strong>.
            </p>
          }
          onComplete={() => goToPage("completion", "completion")}
        />
      ) : null}

      {page === "completion" ? <ExperimentCompletePage /> : null}
    </main>
  );
}

function getPageFromFlowStep(flowStep) {
  return FLOW_STEP_TO_PAGE[flowStep] || "welcome";
}

function getInitialIdentity() {
  if (typeof window === "undefined") {
    return null;
  }

  return readStoredIdentity();
}

function getPreviewFlowStep() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("preview") || "";
}
