const DRAFT_PREFIX = "humanRobotExperiment.questionnaireDraft";

export function getQuestionnaireDraft(sessionId, questionnaireId) {
  if (!sessionId || !questionnaireId) {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(
      getDraftKey(sessionId, questionnaireId)
    );
    return storedValue ? JSON.parse(storedValue) : null;
  } catch {
    return null;
  }
}

export function saveQuestionnaireDraft(sessionId, questionnaireId, draft) {
  if (!sessionId || !questionnaireId) {
    return;
  }

  window.localStorage.setItem(
    getDraftKey(sessionId, questionnaireId),
    JSON.stringify({
      ...draft,
      savedAt: new Date().toISOString()
    })
  );
}

export function clearQuestionnaireDraft(sessionId, questionnaireId) {
  if (!sessionId || !questionnaireId) {
    return;
  }

  window.localStorage.removeItem(getDraftKey(sessionId, questionnaireId));
}

function getDraftKey(sessionId, questionnaireId) {
  return `${DRAFT_PREFIX}:${sessionId}:${questionnaireId}`;
}
