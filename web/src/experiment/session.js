import {
  clearStoredCompletedTaskPhaseTasksForPhase
} from "./completedTaskPhaseTasks.js";
import {
  clearQuestionnaireDraft
} from "./questionnaireDrafts.js";
import {
  clearCurrentFlowStepData,
  resumeExperimentSession,
  startExperimentSession
} from "./api.js";

const IDENTITY_STORAGE_KEY = "humanRobotExperiment.identity";
const DEFAULT_FLOW_STEP = "experiment_notice";
let identityInitializationPromise = null;
let reloadCleanupHandled = false;
let remoteReloadCleanupHandled = false;

export async function initializeExperimentIdentity() {
  if (identityInitializationPromise) {
    return identityInitializationPromise;
  }

  identityInitializationPromise = loadExperimentIdentity();

  try {
    return await identityInitializationPromise;
  } finally {
    identityInitializationPromise = null;
  }
}

async function loadExperimentIdentity() {
  const cachedIdentity = readStoredIdentity();

  if (cachedIdentity?.participantId && cachedIdentity?.sessionId) {
    try {
      await clearRemoteCurrentPageDataAfterReload(cachedIdentity);
      const resumedIdentity = await resumeExperimentSession({
        participantId: cachedIdentity.participantId,
        sessionId: cachedIdentity.sessionId
      });
      const localIdentity = withLocalFlowStep(
        resumedIdentity,
        cachedIdentity.currentFlowStep
      );
      storeExperimentIdentity(localIdentity);
      return localIdentity;
    } catch {
      clearExperimentIdentity();
    }
  }

  const identity = await startExperimentSession({
    currentFlowStep: DEFAULT_FLOW_STEP
  });
  const localIdentity = withLocalFlowStep(identity, identity.currentFlowStep);
  storeExperimentIdentity(localIdentity);
  return localIdentity;
}

function withLocalFlowStep(identity, localFlowStep) {
  return {
    ...identity,
    currentFlowStep:
      localFlowStep || identity.currentFlowStep || DEFAULT_FLOW_STEP
  };
}

export function storeExperimentIdentity(identity) {
  window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
}

export function updateStoredFlowStep(currentFlowStep) {
  const identity = readStoredIdentity();

  if (!identity) {
    return;
  }

  storeExperimentIdentity({
    ...identity,
    currentFlowStep
  });
}

export function clearExperimentIdentity() {
  window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
}

export function readStoredIdentity() {
  try {
    const storedValue = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    const identity = storedValue ? JSON.parse(storedValue) : null;
    clearCurrentPageDataAfterReload(identity);
    return identity;
  } catch {
    return null;
  }
}

function clearCurrentPageDataAfterReload(identity) {
  if (
    reloadCleanupHandled ||
    !identity?.sessionId ||
    !isBrowserReload()
  ) {
    return;
  }

  reloadCleanupHandled = true;

  switch (identity.currentFlowStep) {
    case "pre_experiment_questionnaire":
      clearQuestionnaireDraft(identity.sessionId, "pre_experiment_questionnaire");
      break;
    case "next_experiment_placeholder":
      clearStoredCompletedTaskPhaseTasksForPhase(
        identity.sessionId,
        "phase_2_task_phase"
      );
      break;
    case "phase_3_task_phase":
      clearStoredCompletedTaskPhaseTasksForPhase(
        identity.sessionId,
        "phase_3_task_phase"
      );
      break;
    default:
      break;
  }
}

function isBrowserReload() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigationEntries = window.performance?.getEntriesByType?.("navigation");
  if (navigationEntries?.[0]?.type) {
    return navigationEntries[0].type === "reload";
  }

  return window.performance?.navigation?.type === 1;
}

async function clearRemoteCurrentPageDataAfterReload(identity) {
  if (
    remoteReloadCleanupHandled ||
    !identity?.participantId ||
    !identity?.sessionId ||
    !identity?.currentFlowStep ||
    !isBrowserReload()
  ) {
    return;
  }

  remoteReloadCleanupHandled = true;

  try {
    await clearCurrentFlowStepData({
      participantId: identity.participantId,
      sessionId: identity.sessionId,
      currentFlowStep: identity.currentFlowStep
    });
  } catch (error) {
    console.warn("Could not clear current page data after reload.", error);
  }
}
