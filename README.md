# Human-Robot Communication Experiment

This repository contains the scaffold for a web-based human-robot communication experiment.

The current architecture is documented in:

```text
docs/project_overview.md
```

## Project Areas

```text
web/
  Participant-facing experiment website.

server/
  Backend API for audio upload, OpenAI speech-to-text, robot action decisions, and data logging.

unity/
  Unity project and WebGL build output for the welcome scene and Room Tour scene.

docs/
  Project memory, architecture notes, and experiment documentation.
```

## Current Status

The initial complete local experiment flow is implemented and tested as of
2026-05-19.

Current working sequence:

```text
Welcome / device calibration
  -> Personal Background Questionnaire
  -> Environment Introduction memory page
  -> Room Tour interaction
  -> Task Phase, first-day interaction, Unity Ex_Stage_1
  -> Phase 2 end questionnaire
  -> Many Days Later transition page
  -> Task Phase, many-days-later interaction, Unity Ex_Stage_2
  -> Phase 3 end questionnaire
  -> Experiment Complete / thank-you page
```

Current working pieces:

- React/Vite participant page at `web/`.
- Express backend at `server/`.
- Supabase participant/session creation and resume support.
- Browser voice recording with click-to-start and click-to-stop behavior.
- Microphone device selector and live volume meter.
- Audio upload from frontend to backend through `POST /api/speech/turn`.
- OpenAI transcription and task/room-tour decision prompts on the backend.
- Unity WebGL embedding for `Welcome_Scene`, `Room_Tour`, `Ex_Stage_1`, and
  `Ex_Stage_2`.
- Pre-Unity audio playback check using `web/public/audio/HAT.wav`.
- Custom pre-experiment personal background questionnaire adapted from the
  Qualtrics QSF survey.
- Environment Introduction memory page with a 3-minute timer, room-information
  image/text cards, and a completion screen.
- Room Tour interaction with free room-detail recording, duplicate summary
  suppression, targeted follow-up questions, and final Room Tour result storage
  in `room_tour_results`.
- Task Phase manager integration for two task rounds:
  `web/public/unity/Ex_Stage_1` and `web/public/unity/Ex_Stage_2`.
- Fixed and random task ordering, random condition assignment, prerecorded robot
  response clips, optional user replies, clarification pauses, and trial-level
  task questionnaires.
- Trial results stored in `task_phase_trial_results` with a `phase` field so
  Phase 2 and Phase 3 task indices do not overwrite each other.
- Phase-end questionnaires stored in `phase_end_questionnaire_submissions`.
- Final completion / thank-you page after Phase 3.

## Suggested Next Steps

1. Run a final full pilot pass with a fresh browser session and confirm all
   Supabase rows are written as expected.
2. Freeze the task IDs, Unity task configs, and final audio clip assignments for
   data collection.
3. Add optional full speech-turn/audio-file logging if raw participant audio or
   turn-level transcripts are required by the final study protocol.
4. Prepare deployment instructions for the final hosting environment.
