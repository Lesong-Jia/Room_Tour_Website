import { useEffect, useRef, useState } from "react";
import { uploadSpeechTurn } from "../experiment/api.js";

const RECORDING_MIME_TYPES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/aac",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus"
];

function getSupportedMimeType() {
  if (!window.MediaRecorder) {
    return "";
  }

  return (
    RECORDING_MIME_TYPES.find((mimeType) =>
      window.MediaRecorder.isTypeSupported(mimeType)
    ) || ""
  );
}

export default function VoiceRecorder({
  context,
  disabled = false,
  disabledMessage = "",
  buttonHint = "",
  feedback,
  onDecision
}) {
  const [permissionState, setPermissionState] = useState("unknown");
  const [recorderState, setRecorderState] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [audioInputs, setAudioInputs] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [volumeLevel, setVolumeLevel] = useState(0);

  useEffect(() => {
    async function checkMicrophonePermission() {
      if (!navigator.permissions?.query) {
        return;
      }

      try {
        const permission = await navigator.permissions.query({
          name: "microphone"
        });
        setPermissionState(permission.state);
        permission.onchange = () => setPermissionState(permission.state);
      } catch {
        setPermissionState("unknown");
      }
    }

    checkMicrophonePermission();
    refreshAudioInputs();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshAudioInputs);

    return () => {
      stopVolumeMeter();
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        refreshAudioInputs
      );
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function refreshAudioInputs() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((device) => device.kind === "audioinput");
      setAudioInputs(inputs);
      setSelectedDeviceId((currentDeviceId) => {
        if (
          currentDeviceId &&
          inputs.some((device) => device.deviceId === currentDeviceId)
        ) {
          return currentDeviceId;
        }

        return inputs[0]?.deviceId || "";
      });
    } catch {
      setAudioInputs([]);
    }
  }

  async function startRecording() {
    if (disabled) {
      return;
    }

    setErrorMessage("");
    setStatusMessage("");

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setRecorderState("unsupported");
      setErrorMessage(
        "Audio recording is not supported in this browser. Please use Chrome on a computer."
      );
      return;
    }

    let stream;

    try {
      stream = await getMicrophoneStream();
      refreshAudioInputs();
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startVolumeMeter(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const recordedChunks = chunksRef.current;
        const recordedMimeType = mediaRecorder.mimeType || mimeType;

        mediaRecorderRef.current = null;
        chunksRef.current = [];
        const audioBlob = new Blob(recordedChunks, {
          type: recordedMimeType || "audio/webm"
        });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        stopVolumeMeter();

        if (recordedChunks.length === 0 || audioBlob.size === 0) {
          setRecorderState("idle");
          setStatusMessage("");
          setErrorMessage(
            "No audio was recorded. Please check the microphone permission and try again."
          );
          return;
        }

        setRecorderState("sending");
        sendAudioTurn(audioBlob, recordedMimeType);
      };

      mediaRecorder.onerror = () => {
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        stopVolumeMeter();
        setRecorderState("idle");
        setStatusMessage("");
        setErrorMessage(
          "The microphone recording stopped unexpectedly. Please try again."
        );
      };

      setPermissionState("granted");
      setRecorderState("recording");
      mediaRecorder.start(1000);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setRecorderState("idle");
      stopVolumeMeter();
      setPermissionState(error.name === "NotAllowedError" ? "denied" : "unknown");
      setErrorMessage(
        error.name === "NotAllowedError"
          ? "Microphone permission was blocked. Please allow microphone access and try again."
          : "The microphone could not be started. Please check your device and try again."
      );
    }
  }

  async function getMicrophoneStream() {
    if (!selectedDeviceId) {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: selectedDeviceId }
        }
      });
    } catch (error) {
      if (error.name !== "OverconstrainedError") {
        throw error;
      }

      return navigator.mediaDevices.getUserMedia({ audio: true });
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      setRecorderState("sending");
      setStatusMessage("Sending voice input to robot...");
      mediaRecorderRef.current.stop();
    }
  }

  function startVolumeMeter(stream) {
    stopVolumeMeter();

    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.78;
    const samples = new Uint8Array(analyser.fftSize);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    function updateVolume() {
      analyser.getByteTimeDomainData(samples);

      let sum = 0;
      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / samples.length);
      setVolumeLevel(Math.min(1, rms * 5));
      animationFrameRef.current = window.requestAnimationFrame(updateVolume);
    }

    updateVolume();
  }

  function stopVolumeMeter() {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    analyserRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setVolumeLevel(0);
  }

  async function sendAudioTurn(audioBlob, mimeType) {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, getAudioFilename(mimeType));

      Object.entries(context || {}).forEach(([key, value]) => {
        formData.append(key, value);
      });

      const result = await uploadSpeechTurn(formData);

      setRecorderState("idle");
      setStatusMessage("");
      setVolumeLevel(0);
      onDecision?.(result);
    } catch (error) {
      setRecorderState("idle");
      setStatusMessage("");
      setVolumeLevel(0);
      setErrorMessage(
        error.message ||
          "The robot could not process your voice input. Please try again."
      );
    }
  }

  const isRecording = recorderState === "recording";
  const isSending = recorderState === "sending";

  return (
    <section className="voice-card" aria-label="Voice input controls">
      <div className="recording-panel">
        <button
          className={isRecording ? "record-button recording" : "record-button"}
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isSending}
          aria-pressed={isRecording}
        >
          <span className="record-dot" aria-hidden="true" />
          {disabled
            ? "Voice input paused"
            : isSending
            ? "Sending to robot..."
            : isRecording
              ? "Stop voice input and send"
              : "Start voice input"}
        </button>
      </div>

      <p className="voice-copy">
        Click once to start voice input, then click again to stop and send to
        robot.
      </p>
      {buttonHint ? <p className="voice-button-hint">{buttonHint}</p> : null}

      <label className="microphone-select">
        <span>Microphone</span>
        <select
          value={selectedDeviceId}
          onChange={(event) => setSelectedDeviceId(event.target.value)}
          disabled={disabled || isRecording || isSending}
        >
          {audioInputs.length === 0 ? (
            <option value="">Default microphone</option>
          ) : (
            audioInputs.map((device, index) => (
              <option key={device.deviceId || index} value={device.deviceId}>
                {device.label || `Microphone ${index + 1}`}
              </option>
            ))
          )}
        </select>
      </label>

      <div className="volume-meter" aria-hidden="true">
        <span style={{ width: `${Math.round(volumeLevel * 100)}%` }} />
      </div>

      {errorMessage ? <p className="error-message">{errorMessage}</p> : null}
      {disabled && disabledMessage ? (
        <p className="status-message">{disabledMessage}</p>
      ) : null}
      {feedback ? <p className="feedback-message">{feedback}</p> : null}
      {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
    </section>
  );
}

function getAudioFilename(mimeType) {
  if (mimeType?.includes("mp4")) {
    return "participant-audio.mp4";
  }

  return "participant-audio.webm";
}
