import { useRef, useState } from "react";

const AUDIO_CHECK_URL = "/audio/HAT.wav";
const TARGET_WORD = "HAT";

export default function AudioPlaybackCheck({ onPassed }) {
  const audioRef = useRef(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");

  async function playAudioCheck() {
    setFeedback("");

    if (!audioRef.current) {
      setFeedback("Audio playback is not ready yet. Please try again.");
      return;
    }

    try {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
    } catch {
      setFeedback("Audio playback failed. Please check your browser volume.");
    }
  }

  function handleAnswerChange(event) {
    setAnswer(event.target.value.toUpperCase());
    setFeedback("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (answer.trim() === TARGET_WORD) {
      setFeedback("");
      onPassed?.();
      return;
    }

    setFeedback("That did not match the audio. Please play it again and retry.");
  }

  return (
    <form className="audio-check-card" onSubmit={handleSubmit}>
      <audio ref={audioRef} src={AUDIO_CHECK_URL} preload="auto" />
      <h3>Audio Check</h3>
      <p>
        To make sure you can hear the speech in this experiment, click the play
        button, type the word you hear into the box, and click Submit to
        continue.
      </p>

      <div className="audio-check-controls">
        <button className="audio-play-button" type="button" onClick={playAudioCheck}>
          Play Audio
        </button>

        <label className="audio-answer-field">
          <span>Word heard</span>
          <input
            type="text"
            value={answer}
            onChange={handleAnswerChange}
            autoComplete="off"
            inputMode="text"
          />
        </label>

        <button className="audio-submit-button" type="submit">
          Submit
        </button>
      </div>

      {feedback ? <p className="audio-check-feedback">{feedback}</p> : null}
    </form>
  );
}
