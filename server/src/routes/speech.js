import { Router } from "express";
import multer from "multer";
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

    const transcript = await transcribeAudio(request.file, request.body);
    const decision = await decideRobotAction({
      transcript,
      context: request.body
    });

    response.json({
      turnId: `turn_${Date.now()}`,
      context: request.body,
      transcript,
      decision
    });
  } catch (error) {
    next(error);
  }
});

export default router;
