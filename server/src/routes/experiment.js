import { Router } from "express";
import {
  clearCurrentFlowStepData,
  logExperimentEvent
} from "../services/dataLogger.js";
import {
  resumeExperimentSession,
  startExperimentSession
} from "../services/sessionService.js";

const router = Router();

router.post("/session/start", async (request, response, next) => {
  try {
    const identity = await startExperimentSession({
      currentFlowStep: request.body.currentFlowStep,
      conditionId: request.body.conditionId,
      roomTourCondition: request.body.roomTourCondition,
      taskResponseCondition: request.body.taskResponseCondition,
      userAgent: request.get("user-agent") || ""
    });

    response.json(identity);
  } catch (error) {
    next(error);
  }
});

router.post("/session/resume", async (request, response, next) => {
  try {
    const identity = await resumeExperimentSession(request.body);
    response.json(identity);
  } catch (error) {
    next(error);
  }
});

router.post("/event", async (request, response, next) => {
  try {
    await logExperimentEvent(request.body);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/session/clear-current-flow-step-data", async (request, response, next) => {
  try {
    const result = await clearCurrentFlowStepData(request.body);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
