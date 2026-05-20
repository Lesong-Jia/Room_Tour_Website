import OpenAI from "openai";

const TRANSCRIPTION_MODEL =
  process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe";

let client;

export async function transcribeAudio(audioFile, _context) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (!audioFile?.buffer?.length) {
    throw new Error("Audio file is required.");
  }

  const filename = audioFile.originalname || "participant-audio.webm";
  const file = new File([audioFile.buffer], filename, {
    type: audioFile.mimetype || "audio/webm"
  });

  const transcription = await getOpenAIClient().audio.transcriptions.create({
    file,
    model: TRANSCRIPTION_MODEL
  });

  return transcription.text?.trim() || "";
}

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  return client;
}
