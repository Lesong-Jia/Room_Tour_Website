import { Router } from "express";
import { logUnityEvent } from "../services/dataLogger.js";

const router = Router();

router.post("/", async (request, response, next) => {
  try {
    await logUnityEvent(request.body);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
