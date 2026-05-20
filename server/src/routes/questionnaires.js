import { Router } from "express";
import { logQuestionnaireSubmission } from "../services/dataLogger.js";

const router = Router();

router.post("/submission", async (request, response, next) => {
  try {
    const result = await logQuestionnaireSubmission(request.body);
    response.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
