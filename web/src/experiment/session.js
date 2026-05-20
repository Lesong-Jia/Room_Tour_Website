import {
  resumeExperimentSession,
  startExperimentSession
} from "./api.js";

const IDENTITY_STORAGE_KEY = "humanRobotExperiment.identity";
const DEFAULT_FLOW_STEP = "welcome";
let identityInitializationPromise = null;

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
      const resumedIdentity = await resumeExperimentSession({
        participantId: cachedIdentity.participantId,
        sessionId: cachedIdentity.sessionId
      });
      const localIdentity = withLocalDefaultFlowStep(resumedIdentity);
      storeExperimentIdentity(localIdentity);
      return localIdentity;
    } catch {
      clearExperimentIdentity();
    }
  }

  const identity = await startExperimentSession({
    currentFlowStep: DEFAULT_FLOW_STEP
  });
  const localIdentity = withLocalDefaultFlowStep(identity);
  storeExperimentIdentity(localIdentity);
  return localIdentity;
}

function withLocalDefaultFlowStep(identity) {
  return {
    ...identity,
    currentFlowStep: DEFAULT_FLOW_STEP
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
    return storedValue ? JSON.parse(storedValue) : null;
  } catch {
    return null;
  }
}
