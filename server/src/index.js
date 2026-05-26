import cors from "cors";
import "dotenv/config";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import experimentRoutes from "./routes/experiment.js";
import questionnaireRoutes from "./routes/questionnaires.js";
import roomTourRoutes from "./routes/roomTour.js";
import speechRoutes from "./routes/speech.js";
import taskPhaseRoutes from "./routes/taskPhase.js";
import unityEventRoutes from "./routes/unityEvents.js";

const app = express();
const port = process.env.PORT || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));
const webDistPath = resolve(__dirname, "../../web/dist");
const webIndexPath = resolve(webDistPath, "index.html");

app.use(
  cors({
    origin: process.env.WEB_ORIGIN
      ? process.env.WEB_ORIGIN.split(",")
      : ["http://localhost:5173", "http://127.0.0.1:5173"]
  })
);
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.use("/api/experiment", experimentRoutes);
app.use("/api/questionnaires", questionnaireRoutes);
app.use("/api/room-tour", roomTourRoutes);
app.use("/api/speech", speechRoutes);
app.use("/api/task-phase", taskPhaseRoutes);
app.use("/api/unity-events", unityEventRoutes);

if (existsSync(webIndexPath)) {
  app.use(
    express.static(webDistPath, {
      setHeaders(response, filePath) {
        setUnityStaticHeaders(response, filePath);
      }
    })
  );

  app.get(/^\/(?!api\/).*/, (_request, response) => {
    response.sendFile(webIndexPath);
  });
}

app.use((error, _request, response, _next) => {
  console.error(error);
  const status = error.status || error.statusCode || 500;

  response.status(status).json({
    error: {
      message: error.message || "Internal server error",
      type: error.type || error.name || "Error",
      status
    }
  });
});

app.listen(port, () => {
  console.log(`Experiment API listening on port ${port}`);
});

function setUnityStaticHeaders(response, filePath) {
  if (!filePath.replaceAll("\\", "/").includes("/unity/")) {
    return;
  }

  if (filePath.endsWith(".br")) {
    response.setHeader("Content-Encoding", "br");
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    addVaryHeader(response, "Accept-Encoding");
  }

  if (filePath.endsWith(".wasm.br") || extname(filePath) === ".wasm") {
    response.setHeader("Content-Type", "application/wasm");
    return;
  }

  if (filePath.endsWith(".js.br")) {
    response.setHeader("Content-Type", "application/javascript");
    return;
  }

  if (filePath.endsWith(".data.br") || extname(filePath) === ".data") {
    response.setHeader("Content-Type", "application/octet-stream");
  }
}

function addVaryHeader(response, value) {
  const currentHeader = response.getHeader("Vary");
  const currentValues = Array.isArray(currentHeader)
    ? currentHeader.join(",")
    : currentHeader || "";
  const values = currentValues
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!values.some((item) => item.toLowerCase() === value.toLowerCase())) {
    values.push(value);
  }

  response.setHeader("Vary", values.join(", "));
}
