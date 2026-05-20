export function sendUnityCommand(command, options = {}) {
  const unityInstance = window.unityInstance;
  const objectName = options.objectName || "WebGLExperimentBridge";
  const methodName = options.methodName || "OnHostCommand";

  if (!unityInstance?.SendMessage) {
    console.info("Unity instance is not ready yet.", command);
    return;
  }

  unityInstance.SendMessage(
    objectName,
    methodName,
    JSON.stringify(command)
  );
}

export function registerUnityEventListener(onUnityEvent) {
  window.handleUnityEvent = (eventJson) => {
    const event = JSON.parse(eventJson);
    onUnityEvent(event);
  };

  return () => {
    delete window.handleUnityEvent;
  };
}
