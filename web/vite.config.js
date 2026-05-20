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

  if (url.endsWith(".wasm.br")) {
    res.setHeader("Content-Type", "application/wasm");
  } else if (url.endsWith(".js.br")) {
    res.setHeader("Content-Type", "application/javascript");
  } else if (url.endsWith(".data.br")) {
    res.setHeader("Content-Type", "application/octet-stream");
  }
}

export default defineConfig({
  plugins: [react(), unityBrotliHeaders()],
  server: {
    port: 5173
  }
});
