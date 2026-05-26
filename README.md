# Human-Robot Communication Experiment

This repository contains the deployment-ready website and backend for a
web-based human-robot communication experiment.

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
  Local Unity source/export area. This folder is ignored in the deployment
  repository except for lightweight documentation.

docs/
  Project memory, architecture notes, and experiment documentation.
```

## Current Status

The initial complete local experiment flow was implemented and tested as of
2026-05-19. As of 2026-05-22, the project has also been prepared for GitHub and
Render deployment. As of 2026-05-25, the current build is prepared for formal
CloudResearch testing with condition assignment, speech/audio logging, and
refresh cleanup.

Current working sequence:

```text
Welcome notice / device calibration
  -> Personal Background Questionnaire
  -> Environment Introduction memory page
  -> optional Room Tour interaction
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
- Supabase participant/session creation, resume support, and atomic condition
  assignment.
- Initial condition sequence:
  1. `no_room_tour + just_ok`
  2. `user_lead + explanation`
  3. `robot_lead + confirmation_first`
  After these three, participants cycle through all nine Room Tour x task
  response condition combinations.
- Browser voice recording with click-to-start and click-to-stop behavior.
- Microphone device selector and live volume meter.
- Audio upload from frontend to backend through `POST /api/speech/turn`.
- OpenAI transcription and task/room-tour decision prompts on the backend.
- Turn-level speech logging in Supabase: raw audio files in the private
  `speech-turn-audio` Storage bucket, plus transcript, context, and decision
  rows in `speech_turns`.
- Unity WebGL embedding for `Welcome_Scene`, `Room_Tour`, `Ex_Stage_1`, and
  `Ex_Stage_2`.
- Pre-Unity audio playback check using `web/public/audio/HAT.wav`.
- Custom pre-experiment personal background questionnaire adapted from the
  Qualtrics QSF survey.
- Environment Introduction memory page with a 5-minute timer, room-information
  image/text cards, and a completion screen.
- Room Tour interaction supports `no_room_tour`, `user_lead`, and `robot_lead`
  conditions. It includes free room-detail recording, duplicate summary
  suppression, targeted follow-up questions, optional robot-lead extra follow-up,
  and final Room Tour result storage in `room_tour_results`.
- Task Phase manager integration for two task rounds:
  `web/public/unity/Ex_Stage_1` and `web/public/unity/Ex_Stage_2`.
- Fixed and random task ordering, random task condition assignment, prerecorded
  robot response clips, task response conditions (`just_ok`, `explanation`,
  `confirmation_first`), clarification pauses, and trial-level task
  questionnaires.
- Trial results stored in `task_phase_trial_results` with a `phase` field so
  Phase 2 and Phase 3 task indices do not overwrite each other.
- Refreshing a current page preserves the participant/session identity but
  clears that page's already-submitted current-stage data from Supabase.
- Phase-end questionnaires stored in `phase_end_questionnaire_submissions`.
- Final completion page after Phase 3 displays the CloudResearch completion code
  `4CAD4C4248`.
- GitHub deployment repository:
  `https://github.com/Lesong-Jia/Room_Tour_Website`.
- Render single-service deployment path using `npm run build` and `npm start`.
- Unity WebGL build files copied into `web/public/unity/` and kept below
  GitHub's 100 MiB file limit.
- First-page participant requirements include native/fluent English and device
  setup guidance. Chrome is recommended; if a 3D model displays incorrectly,
  participants are told to try another browser.

## Suggested Next Steps

1. Run the three planned condition-check passes with fresh sessions and confirm
   assignment indices 0, 1, and 2 map to the expected conditions.
2. Run a hosted full pilot pass and confirm all Supabase rows and Storage audio
   files are written as expected.
3. Monitor Render metrics during pilot sessions and upgrade the instance only if
   memory, CPU, or response times require it.
