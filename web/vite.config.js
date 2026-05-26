import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function unityBrotliHeaders() {
  return {
    name: "unity-brotli-headers",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        setUnityHeaders(req.url, res);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        setUnityHeaders(req.url, res);
        next();
      });
    }
  };
}

function setUnityHeaders(url = "", res) {
  if (!url.includes("/unity/") || !url.endsWith(".br")) {
    return;
  }

  res.setHeader("Content-Encoding", "br");
  addVaryHeader(res, "Accept-Encoding");

  if (url.endsWith(".wasm.br")) {
    res.setHeader("Content-Type", "application/wasm");
  } else if (url.endsWith(".js.br")) {
    res.setHeader("Content-Type", "application/javascript");
  } else if (url.endsWith(".data.br")) {
    res.setHeader("Content-Type", "application/octet-stream");
  }
}

function addVaryHeader(res, value) {
  const currentHeader = res.getHeader("Vary");
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

  res.setHeader("Vary", values.join(", "));
}

export default defineConfig({
  plugins: [react(), unityBrotliHeaders()],
  server: {
    port: 5173
  }
});
