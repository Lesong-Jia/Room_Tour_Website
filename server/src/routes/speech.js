import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { logSpeechTurn } from "../services/dataLogger.js";
import { decideRobotAction } from "../services/robotDecisionService.js";
import { transcribeAudio } from "../services/openaiSpeechService.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

router.post("/turn", upload.single("audio"), async (request, response, next) => {
  const turnId = `turn_${Date.now()}_${randomUUID()}`;
  let transcript = "";
  let decision = null;

  try {
    console.info("Speech turn received", {
      body: request.body,
      file: request.file
        ? {
            fieldname: request.file.fieldname,
            originalname: request.file.originalname,
            mimetype: request.file.mimetype,
            size: request.file.size
          }
        : null
    });

    transcript = await transcribeAudio(request.file, request.body);
    decision = await decideRobotAction({
      transcript,
      context: request.body
    });

    await logSpeechTurn({
      turnId,
      context: request.body,
      audio: request.file,
      transcript,
      decision
    });

    response.json({
      turnId,
      context: request.body,
      transcript,
      decision
    });
  } catch (error) {
    if (request.body?.participantId && request.body?.sessionId) {
      try {
        await logSpeechTurn({
          turnId,
          context: request.body,
          audio: request.file,
          transcript,
          decision: decision || {},
          errorMessage: error.message || "Speech turn failed."
        });
      } catch (loggingError) {
        console.error("Could not save failed speech turn", loggingError);
      }
    }

    next(error);
  }
});

export default router;
