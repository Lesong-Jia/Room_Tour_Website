import { useEffect, useRef, useState } from "react";

const DEFAULT_UNITY_BASE_PATH = "/unity/Welcome_Scene";
const DEFAULT_UNITY_BUILD_PATH = `${DEFAULT_UNITY_BASE_PATH}/Build`;
const DEFAULT_UNITY_LOADER_URL = `${DEFAULT_UNITY_BUILD_PATH}/Welcome_Scene.loader.js`;
const DEFAULT_UNITY_CONFIG = {
  arguments: [],
  dataUrl: `${DEFAULT_UNITY_BUILD_PATH}/Welcome_Scene.data.br`,
  frameworkUrl: `${DEFAULT_UNITY_BUILD_PATH}/Welcome_Scene.framework.js.br`,
  codeUrl: `${DEFAULT_UNITY_BUILD_PATH}/Welcome_Scene.wasm.br`,
  streamingAssetsUrl: `${DEFAULT_UNITY_BASE_PATH}/StreamingAssets`,
  companyName: "DefaultCompany",
  productName: "Welcome_Scene",
  productVersion: "0.1"
};

export default function UnityContainer({
  children,
  sceneStarted,
  deferSafariLoadUntilStarted = false,
  completionOverlay,
  sceneOverlay,
  preStartOverlay,
  sceneTitle = "Welcome Scene",
  unityConfig = DEFAULT_UNITY_CONFIG,
  unityLoaderUrl = DEFAULT_UNITY_LOADER_URL,
  onReady
}) {
  const canvasRef = useRef(null);
  const unityInstanceRef = useRef(null);
  const useSafariWorkarounds = isSafariBrowser();
  const effectiveUnityLoaderUrl = useSafariWorkarounds
    ? appendCacheBuster(unityLoaderUrl)
    : unityLoaderUrl;
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const shouldLoadUnity =
    !deferSafariLoadUntilStarted || !useSafariWorkarounds || sceneStarted;

  useEffect(() => {
    function stopUnityKeyboardCapture(event) {
      if (isEditableElement(event.target)) {
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener("keydown", stopUnityKeyboardCapture);
    window.addEventListener("keyup", stopUnityKeyboardCapture);
    window.addEventListener("keypress", stopUnityKeyboardCapture);

    return () => {
      window.removeEventListener("keydown", stopUnityKeyboardCapture);
      window.removeEventListener("keyup", stopUnityKeyboardCapture);
      window.removeEventListener("keypress", stopUnityKeyboardCapture);
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    async function loadUnity() {
      if (!shouldLoadUnity) {
        setLoadState("waiting");
        setLoadingProgress(0);
        return;
      }

      try {
        setLoadState("loading");
        await loadUnityLoader(effectiveUnityLoaderUrl);

        if (canceled || !canvasRef.current) {
          return;
        }

        const unityInstance = await window.createUnityInstance(
          canvasRef.current,
          withSafariUnityDefaults(unityConfig, useSafariWorkarounds),
          (progress) => {
            if (!canceled) {
              setLoadingProgress(progress);
            }
          }
        );

        if (canceled) {
          unityInstance.Quit?.();
          return;
        }

        unityInstanceRef.current = unityInstance;
        window.unityInstance = unityInstance;
        disableGlobalUnityKeyboardCapture(unityInstance);
        setLoadingProgress(1);
        setLoadState("ready");
        onReady?.();
      } catch (error) {
        if (!canceled) {
          setLoadState("error");
          setErrorMessage(error?.message || "Unity failed to load.");
        }
      }
    }

    loadUnity();

    return () => {
      canceled = true;
      if (window.unityInstance === unityInstanceRef.current) {
        delete window.unityInstance;
      }
      unityInstanceRef.current?.Quit?.();
    };
  }, [
    effectiveUnityLoaderUrl,
    onReady,
    shouldLoadUnity,
    unityConfig,
    useSafariWorkarounds
  ]);

  useEffect(() => {
    if (sceneStarted && loadState === "ready") {
      canvasRef.current?.focus();
    }
  }, [sceneStarted, loadState]);

  return (
    <section className="panel robot-panel" aria-labelledby="robot-scene-title">
      <h2 className="sr-only" id="robot-scene-title">
        {sceneTitle}
      </h2>
      <div className="unity-frame">
        <canvas
          ref={canvasRef}
          id="unity-canvas"
          width="1280"
          height="720"
          tabIndex="0"
        />

        {sceneStarted && loadState !== "ready" ? (
          <div className="unity-loading" role="status" aria-live="polite">
            {loadState === "error" ? (
              <>
                <p>Unity failed to load</p>
                <span>{errorMessage}</span>
              </>
            ) : (
              <>
                <p>Loading Unity scene</p>
                <div className="loading-track">
                  <span style={{ width: `${Math.round(loadingProgress * 100)}%` }} />
                </div>
              </>
            )}
          </div>
        ) : null}

        {!sceneStarted ? (
          preStartOverlay || (
          <div className="scene-cover">
            <h3>
              Please use the button below and say "start the scene" to begin.
            </h3>
          </div>
          )
        ) : null}

        {completionOverlay}
        {sceneOverlay}
      </div>

      {children}
    </section>
  );
}

function disableGlobalUnityKeyboardCapture(unityInstance) {
  const candidates = [
    unityInstance?.Module?.WebGLInput,
    window.Module?.WebGLInput,
    window.WebGLInput
  ];

  candidates
    .filter(Boolean)
    .forEach((webGlInput) => {
      webGlInput.captureAllKeyboardInput = false;
    });
}

function isEditableElement(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']")
  );
}

function loadUnityLoader(unityLoaderUrl) {
  if (
    window.createUnityInstance &&
    window.__experimentUnityLoaderUrl === unityLoaderUrl
  ) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      `script[src="${unityLoaderUrl}"]`
    );

    if (existingScript?.dataset.loaded === "true") {
      window.__experimentUnityLoaderUrl = unityLoaderUrl;
      resolve();
      return;
    }

    if (existingScript) {
      existingScript.addEventListener(
        "load",
        () => {
          existingScript.dataset.loaded = "true";
          window.__experimentUnityLoaderUrl = unityLoaderUrl;
          resolve();
        },
        { once: true }
      );
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = unityLoaderUrl;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      window.__experimentUnityLoaderUrl = unityLoaderUrl;
      resolve();
    };
    script.onerror = () => reject(new Error("Unity loader script failed."));
    document.body.appendChild(script);
  });
}

function withSafariUnityDefaults(unityConfig, useSafariWorkarounds) {
  if (!useSafariWorkarounds) {
    return unityConfig;
  }

  return {
    ...unityConfig,
    dataUrl: appendCacheBuster(unityConfig.dataUrl),
    frameworkUrl: appendCacheBuster(unityConfig.frameworkUrl),
    codeUrl: appendCacheBuster(unityConfig.codeUrl),
    cacheControl: () => "no-store",
    devicePixelRatio: 1
  };
}

function appendCacheBuster(url) {
  if (!url) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}safariUnityFix=20260526`;
}

function isSafariBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(
    navigator.userAgent
  );
}
