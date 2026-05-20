import { Router } from "express";
import { logRoomTourResult } from "../services/dataLogger.js";
import { resetRoomTourProgress } from "../services/robotDecisionService.js";

const router = Router();

router.post("/progress/reset", async (request, response, next) => {
  try {
    const result = resetRoomTourProgress(request.body);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/complete", async (request, response, next) => {
  try {
    const result = await logRoomTourResult(request.body);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
