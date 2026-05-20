import { Router } from "express";
import {
  getTaskPhaseClarificationStatus,
  logTaskPhaseTrialResult,
  markTaskPhaseClarification
} from "../services/dataLogger.js";

const router = Router();

router.post("/trial-result", async (request, response, next) => {
  try {
    const result = await logTaskPhaseTrialResult(request.body);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/clarifications/status", async (request, response, next) => {
  try {
    const result = await getTaskPhaseClarificationStatus(request.body);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/clarifications/mark", async (request, response, next) => {
  try {
    const result = await markTaskPhaseClarification(request.body);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
