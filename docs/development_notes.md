# Development Notes

This file is for implementation notes that should not crowd the main architecture overview.

## Current Milestone

As of 2026-05-19, the initial complete local experiment flow has been
implemented and pilot-tested end to end.

As of 2026-05-22, the project has also been prepared for hosted deployment:

- GitHub repository: `https://github.com/Lesong-Jia/Room_Tour_Website`.
- Render Web Service deployment path is configured through root scripts and
  `render.yaml`.
- The frontend and backend deploy as one Node service: Express serves both API
  routes and `web/dist`.
- `web/public/unity` contains the deployable Unity WebGL builds.
- `unity/UnityProject` and `unity/WebGLBuild` are local-only and ignored by Git.
- Git LFS is not currently used because the deployable Unity data files are all
  below 100 MiB.
- Render environment variables hold OpenAI and Supabase secrets.

As of 2026-05-25, the project has been prepared for CloudResearch testing:

- The first three new sessions are assigned fixed coverage-check conditions:
  `no_room_tour + just_ok`, `user_lead + explanation`, and
  `robot_lead + confirmation_first`.
- Starting at assignment index 3, new sessions cycle through all nine Room Tour
  x task response condition combinations.
- Condition assignment is now server-side and atomic through Supabase
  `assign_experiment_conditions()`.
- Raw participant audio, transcripts, decision outputs, and turn context are
  stored in Supabase via `speech_turns` and the private `speech-turn-audio`
  Storage bucket.
- Current-page refresh keeps the same participant/session but clears
  current-page submitted data from Supabase.
- The final completion page displays CloudResearch completion code
  `4CAD4C4248`.
- The first welcome notice includes the native/fluent English requirement.

Current full flow:

```text
Welcome / audio calibration / Aria greeting
  -> Personal Background Questionnaire
  -> Environment Introduction memory page, 5-minute timer
  -> optional Room Tour
  -> Phase 2 Task Phase using Unity Ex_Stage_1
  -> Phase 2 end questionnaire
  -> Many Days Later transition page
  -> Phase 3 Task Phase using Unity Ex_Stage_2
  -> Phase 3 end questionnaire
  -> Experiment Complete thank-you page
```

Current deployable Unity data file sizes:

```text
Welcome_Scene.data.br  78.10 MiB
Room_Tour.data.br      85.21 MiB
Ex_Stage_1.data.br     90.60 MiB
Ex_Stage_2.data.br     90.58 MiB
```

Key completed pieces in this milestone:

- Room Tour is connected into the main participant flow after Environment
  Introduction.
- Room Tour records all useful room details, not only the eight target items.
  Completely unrelated speech is not recorded; duplicate summaries are
  suppressed.
- Room Tour completion is a full-page web panel, matching the Environment
  Introduction completion template.
- Phase 2 Task Phase and Phase 3 Task Phase share the same web task controller.
  Phase 2 loads `web/public/unity/Ex_Stage_1`; Phase 3 loads
  `web/public/unity/Ex_Stage_2`.
- Task Phase trial result text is green for success and red for failure.
- `TaskPhaseProcessManager` evaluates the Animator at animation time 0 before
  pausing so task start poses match the first animation frame more reliably.
- Phase-end questionnaires are implemented after both task rounds. Phase 2 uses
  the first-day interaction prompt; Phase 3 uses the many-days-later prompt.
- Final completion / thank-you page is implemented.
- Supabase schema now includes:
  `room_tour_results`, `task_phase_trial_results`,
  `task_phase_clarification_status`, `phase_end_questionnaire_submissions`,
  `speech_turns`, and `experiment_condition_assignment_counter`.
- `task_phase_trial_results` includes `phase`, and uniqueness is
  `(session_id, phase, task_index)` so Phase 2 and Phase 3 rows do not overwrite
  one another.

## Earlier Implementation Notes

The notes below preserve earlier implementation context and may describe
intermediate routing or timing values that have since been replaced by the
current milestone above.

The current welcome flow is:

```text
Participant opens the web page
  -> Intro text explains device/browser/microphone requirements
  -> Unity WebGL scene loads behind a full-cover overlay
  -> Participant completes the web audio playback check
       -> Click Play Audio
       -> Hear HAT from web/public/audio/HAT.wav
       -> Type HAT into the input box
       -> Submit to unlock the welcome voice command
  -> Participant clicks Start voice input
  -> Browser records audio
  -> Participant clicks Stop voice input and send
  -> Frontend uploads audio plus current phase context to the backend
  -> Backend transcribes audio with OpenAI
  -> Backend asks the welcome prompt whether the participant said "start the scene" or a similar phrase
  -> Backend returns Yes/No decision
  -> Frontend hides the voice input controls and removes the Unity cover when the answer is Yes
  -> Participant navigates in Unity to meet Aria
  -> Unity plays Aria's introduction animation and audio
  -> Unity reports welcome_robot_greeting_ready when the introduction audio finishes
  -> Frontend shows the voice input controls again
  -> Participant says hi to Aria
  -> Backend checks whether the participant greeted Aria or the robot
  -> If Yes, the frontend covers Unity and shows the welcome calibration completion message
  -> Participant clicks the right-arrow button to continue to the pre-experiment questionnaire
  -> Frontend keeps the cover and shows guidance when the answer is No
```

The welcome page is intentionally controlled by the web frontend. Unity may load in the background, but it should not be interactable until the frontend removes the cover. Unity WebGL keyboard capture is disabled with `unityInstance.Module.WebGLInput.captureAllKeyboardInput = false`, and the audio-check text input stops keyboard propagation so Unity does not steal participant typing.

The current post-welcome questionnaire and environment-introduction flow is:

```text
Practice/welcome completion
  -> Personal Background Questionnaire
  -> Submit questionnaire
  -> Backend writes one row to Supabase pre_experiment_questionnaire
  -> Backend updates experiment_sessions.current_flow_step to environment_intro
  -> Frontend routes to the Environment Introduction memory page
  -> Participant sees only the centered instruction screen
  -> Participant clicks Start
  -> 5-minute countdown starts
  -> Floor Plan, Kitchen, and Living Room image/text sections appear
  -> When time reaches 0, the introduction content disappears
  -> Frontend shows Environment Introduction Complete with a Continue button
  -> Participant clicks Continue
  -> Frontend routes to the Room Tour page
```

The questionnaire content was imported from:

```text
C:/Users/Lesong/Downloads/HumanDomestic_Robot_Communication.qsf
```

The frontend adapts the Qualtrics structure into a more comfortable custom UI:

- Demographic Information.
- Robot Experience.
- Attitudes Toward Domestic Robots.
- Personality / BFI-10 items.
- Matrix questions are rendered as per-statement Likert controls instead of a
  dense Qualtrics-style table.
- Robot-specific experience follow-up questions are conditionally shown only
  after the participant selects the matching robot type.
- The `Other` and gender self-description options reveal short text fields.

The Environment Introduction page is implemented in
`web/src/components/EnvironmentIntroPage.jsx`.

Current Environment Introduction behavior:

```text
Initial screen:
  Environment Introduction
  Memorize Your Home Environment
  Centered instructions telling the participant that the next page contains
  home-environment information and that they will have five minutes to remember it.
  Start button.

After Start:
  Sticky countdown bar appears.
  Timer begins at 5:00.
  The timer bar asks participants to memorize as much page information as possible.
  Floor Plan, Kitchen and Dining Area, and Living Room sections appear.

At 0:00:
  The room-introduction sections are hidden.
  A centered Environment Introduction Complete screen appears.
  The participant must click Continue before moving forward.

After Continue:
  The frontend routes to the Room Tour page.
```

The Environment Introduction content uses image/text cards. Current image assets
are copied into:

```text
web/public/environment/
```

The source image folder is:

```text
C:/Users/Lesong/Desktop/Human-Robot Communication/Resources/Room_Introduction_Images
```

Current Environment Introduction image files:

```text
Floor_Plan.png
Kitchen_Overall.png
Kitchen_Trash_Can.png
Kitchen_Dining_Table.png
Kitchen_Fridge.png
Kitchen_Coffee_Machine.png
Kitchen_Cutting_Board.png
Kitchen_Microwave.png
Living_Room_Overall.png
Living_Room_Plant.png
Living_Room_Rag.png
Living_Room_Candle.png
Living_Room_Book.png
```

Important UI notes:

- The participant ID is not shown on the Environment Introduction page.
- The Start screen is centered.
- The completion screen and Continue button are centered.
- Floor Plan, Kitchen Overview, and Living Room Overview are full-width featured image cards.
- Images keep their original aspect ratio and are not cropped to a fixed ratio.
- The plant description is singular: one plant, gray spray bottle for watering,
  white bottle with green label for plant food.

## Room Tour Current Implementation

The Room Tour page is part of the main participant flow after Environment
Introduction.

Current Room Tour flow:

```text
Participant opens Room Tour page
  -> Frontend resets temporary Room Tour progress for the current session
  -> Unity Room_Tour WebGL build loads behind a start overlay
  -> Participant clicks Start Interaction
  -> Frontend sends start_room_tour_intro to Progress_Manager.HandleHostCommand
  -> Unity plays intro audio and locks movement
  -> Unity reports room_tour_intro_completed
  -> Frontend shows the web voice input control
  -> Participant introduces room items freely
  -> Backend classifies explanations against eight known room items when relevant
  -> Frontend records useful room details as short English summaries
  -> Duplicate or near-duplicate summaries are suppressed
  -> Robot plays first / random / unrelated confirmation clips
  -> Participant says they are done with the initial introduction
  -> Frontend sends covered target-item state to Unity
  -> Unity asks missing targeted follow-up questions for trash can, cutting board, rag, and candle
  -> Backend judges each targeted answer leniently by meaning
  -> Unity retries the current question if the answer is unrelated
  -> After all four target items are answered or skipped, Unity asks for additional preferences
  -> Backend classifies preference follow-up responses as relevant, complete, or unrelated
  -> Participant says they have nothing else to add
  -> Frontend uploads final Room Tour result to Supabase room_tour_results
  -> Frontend shows the full-page Room Tour completion screen
```

Room Tour frontend files:

```text
web/src/components/RoomTourPage.jsx
web/src/components/UnityContainer.jsx
web/src/components/VoiceRecorder.jsx
web/src/experiment/api.js
web/src/experiment/unityBridge.js
web/src/styles.css
```

Room Tour backend files:

```text
server/src/routes/roomTour.js
server/src/routes/speech.js
server/src/services/robotDecisionService.js
server/src/services/dataLogger.js
server/src/prompts/room_tour_explanation_prompt.txt
server/src/prompts/room_tour_target_answer_prompt.txt
server/src/prompts/room_tour_preference_followup_prompt.txt
```

Room Tour Unity files:

```text
unity/UnityProject/RoomTour_Feedback_Experiment/Assets/Scripts/Room_Tour_User_Lead_Process_Manager.cs
unity/UnityProject/RoomTour_Feedback_Experiment/Assets/Scripts/RobotFollowParticipant.cs
unity/UnityProject/RoomTour_Feedback_Experiment/Assets/Scripts/WebHostBridge.cs
unity/UnityProject/RoomTour_Feedback_Experiment/Assets/Plugins/WebGL/ExperimentWebBridge.jslib
```

The Room Tour Unity scene currently used for development is:

```text
Assets/Scenes/Room_Tour_User_Lead.unity
```

The current Room Tour Unity build is copied from:

```text
unity/WebGLBuild/Room_Tour
```

to:

```text
web/public/unity/Room_Tour
```

The current build format is Brotli-compressed. `RoomTourPage.jsx` expects:

```text
web/public/unity/Room_Tour/Build/Room_Tour.loader.js
web/public/unity/Room_Tour/Build/Room_Tour.data.br
web/public/unity/Room_Tour/Build/Room_Tour.framework.js.br
web/public/unity/Room_Tour/Build/Room_Tour.wasm.br
```

If a future Unity export switches compression format, update `RoomTourPage.jsx`
and the server/Vite Brotli headers together.

Important Unity Inspector fields on `Progress_Manager` /
`Room_Tour_User_Lead_Process_Manager`:

```text
Robot Audio Source
Intro Clip
First Explanation Confirmation Clip
Unrelated Explanation Clip
Confirmation Clips[3]

Fade Image
Target Questions[4]
  Item Id: 1 trash can, 4 cutting board, 6 rag, 7 candle
  Participant Position
  Robot Position
  Question Clip
  Retry Clip
Final Participant Position
Final Robot Position
Post Target Questions Thank You Clip
Post Target Questions Preference Question Clip
First Preference Response Clip
Post Target Questions Unrelated Preference Clip
```

If `Target Questions` item IDs are left as `0`, the process manager now fills
them by array order as `1, 4, 6, 7`.

Room Tour targeted item IDs:

```text
1 = trash can
4 = cutting board
6 = rag
7 = candle
```

Room Tour state behavior:

- Temporary Room Tour progress lives in backend memory under the current
  `sessionId`, `participantId`, or `participantCode`.
- Opening or refreshing the Room Tour page calls
  `POST /api/room-tour/progress/reset`, clearing temporary `coveredItemIds` and
  `targetAnsweredItemIds` for this session.
- Final Room Tour completion calls `POST /api/room-tour/complete`.
- Final results are stored in Supabase table `room_tour_results`.
- Refreshing after final completion starts a fresh local Room Tour attempt, but
  does not delete already uploaded `room_tour_results` rows.

Robot follow behavior:

- `RobotFollowParticipant` follows through NavMesh only after activation.
- The activation condition is the participant's first back-turn, controlled by
  `activateAfterFirstBackTurn` and `backTurnDotThreshold`.
- During targeted follow-up questions, participant movement and robot follow
  are disabled.
- After the preference question audio finishes, participant movement is restored
  and the robot follow script is reset to wait for the next first back-turn.

## Task Phase Current Implementation

The same React task controller is used for both task rounds:

```text
Phase 2 Task Phase:
  web/public/unity/Ex_Stage_1
  phase = phase_2_task_phase

Phase 3 Task Phase:
  web/public/unity/Ex_Stage_2
  phase = phase_3_task_phase
```

Both pages use:

```text
web/src/components/TaskPhasePage.jsx
unity/UnityProject/RoomTour_Feedback_Experiment/Assets/Scripts/TaskPhaseProcessManager.cs
server/src/prompts/task_phase_instruction_prompt.txt
server/src/prompts/task_phase_start_reply_prompt.txt
server/src/prompts/task_phase_clarification_answer_prompt.txt
```

Unity command target:

```text
Progress_Manager.HandleHostCommand
```

Current task-flow behavior:

- Unity sends `task_phase_scene_ready`; the web page enables the Start button.
- The participant clicks Start Tasks.
- Unity builds 8 fixed tasks plus 3 random tasks.
- Fixed tasks have one main animation and optional mid-animation clarification.
- Random tasks are selected from the random pool and assigned one of three
  conditions:
  `believes_correct_actually_wrong`, `believes_wrong_actually_wrong`,
  `believes_wrong_actually_correct`.
- The web overlay shows the task instruction text keyed by Unity `taskId`.
- The participant gives a voice instruction through the web `VoiceRecorder`.
- The backend accepts semantically similar instructions, ASR errors, and near
  homophones rather than requiring exact text.
- Robot start-response audio clips are configured in Unity. Arrays are
  randomized by `GetRandomClip`, ignoring empty slots.
- If a robot response asks the participant for yes/no, the web voice context
  switches to `task_phase_start_reply`.
- A global positive acknowledgement clip array can be used after valid yes/no
  replies before animation playback.
- Fixed task clarification can be skipped when prior Room Tour data or the
  initial task instruction already answered the relevant clarification.
- The shared Unity animation event for fixed-task clarification is
  `PauseForClarificationQuestion()`.
- At task end, Unity holds the final animation frame, fades audio and the black
  `fadeImage`, destroys configured end-of-task objects, then notifies the web
  page to show the trial questionnaire.
- Trial result text is green for success and red for failure.
- Trial results are written through `POST /api/task-phase/trial-result`.
- Rows in `task_phase_trial_results` are unique by `(session_id, phase,
  task_index)`.

Current task IDs:

```text
Fixed:
making_coffee
can_meat
chopping_vegetables
heating_food_microwave
pick_up_trash
boxing_books
clean_tv
light_candle

Random:
turn_on_work_table_light
hang_up_paint
pick_laptop_to_work_table
place_vase_top_shelf
sort_tools_to_toolbox
put_leftovers_in_fridge
replace_floor_lamp_bulb
spray_insecticide_houseplant
```

Current task WebGL builds are copied from:

```text
unity/WebGLBuild/Ex_Stage_1 -> web/public/unity/Ex_Stage_1
unity/WebGLBuild/Ex_Stage_2 -> web/public/unity/Ex_Stage_2
```

The latest builds use Brotli-compressed Unity files:

```text
Ex_Stage_1.data.br / Ex_Stage_1.framework.js.br / Ex_Stage_1.wasm.br
Ex_Stage_2.data.br / Ex_Stage_2.framework.js.br / Ex_Stage_2.wasm.br
```

## Phase-End Questionnaires

Both task rounds use `PostInteractionQuestionnairePage.jsx`.

Phase 2 prompt:

```text
Please imagine that the introduction and task execution you just completed were
your first-day interaction with this robot after it arrived at your home. Based
on your experience, please complete the questionnaire below.
```

Phase 3 prompt:

```text
Please answer the following questions based on the interaction between you and
the robot many days later.
```

Each phase-end questionnaire includes:

- UEQ-S, 8 semantic-differential items.
- NASA-TLX, 6 workload items.
- Attitudes and Trust Toward This Domestic Robot, 5 agreement items.

Submissions are stored in:

```text
phase_end_questionnaire_submissions
```

After Phase 2 submission, the web page routes to the Many Days Later transition.
After Phase 3 submission, the web page routes to the final Experiment Complete
thank-you page.

## Local Development

Expected local service URLs:

```text
web:    http://localhost:5173 or http://127.0.0.1:5173
server: http://localhost:3001 or http://127.0.0.1:3001
```

The root `package.json` includes convenience scripts:

```text
npm run dev:web
npm run dev:server
```

Dependencies are installed separately inside `web/` and `server/`.

Useful commands:

```text
cd web
npm install
npm run dev
npm run build

cd server
npm install
npm run dev
```

The backend can be checked with:

```text
http://127.0.0.1:3001/health
```

If the frontend shows `Failed to fetch` after recording, the most common cause is that the backend is not running on port `3001`.

## Environment Variables

The backend reads environment variables from `server/.env`.

Required for the current welcome voice flow:

```text
OPENAI_API_KEY=
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_DECISION_MODEL=gpt-5.2
PORT=3001
WEB_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

Supabase variables are required for hosted data collection and speech-turn
audio/transcript logging:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_AUDIO_BUCKET=speech-turn-audio
```

Never put real API keys in frontend files or Unity. OpenAI and Supabase service keys must stay in the backend.

The current questionnaire/session flow requires Supabase to be configured in
`server/.env`:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is used only by the Express backend.

## Frontend Implementation Notes

Important files:

```text
web/src/App.jsx
web/src/components/PhaseController.jsx
web/src/components/AudioPlaybackCheck.jsx
web/src/components/UnityContainer.jsx
web/src/components/VoiceRecorder.jsx
web/src/components/DemographicPage.jsx
web/src/components/EnvironmentIntroPage.jsx
web/src/experiment/api.js
web/src/experiment/session.js
web/src/experiment/questionnaires.js
web/src/experiment/questionnaireDrafts.js
web/src/styles.css
web/vite.config.js
```

`App.jsx` initializes the participant/session identity before the experiment
flow. It maps stored/current flow steps to pages:

```text
pre_experiment_questionnaire -> DemographicPage
environment_intro            -> EnvironmentIntroPage
```

For local development, the app currently starts directly on the questionnaire
page rather than the welcome page.

`web/src/experiment/session.js` owns browser-side experiment identity:

```text
localStorage key: humanRobotExperiment.identity

participantId
participantCode
sessionId
currentFlowStep
```

The first page load calls:

```text
POST /api/experiment/session/start
```

Later refreshes call:

```text
POST /api/experiment/session/resume
```

The identity initializer uses a module-level single-flight promise so React
StrictMode in development cannot create duplicate participants by running the
effect twice.

`questionnaireDrafts.js` stores in-progress questionnaire answers in
`localStorage` under a session/questionnaire-specific key. This is only a
refresh-protection draft; the authoritative submitted data is in Supabase.

`DemographicPage.jsx` submits the pre-experiment questionnaire to:

```text
POST /api/questionnaires/submission
```

The request includes `participantId`, `participantCode`, `sessionId`,
`questionnaireScope: "pre_experiment"`, `phase:
"pre_experiment_questionnaire"`, `nextFlowStep: "environment_intro"`, and the
front-end answer records.

`AudioPlaybackCheck.jsx` owns the first web audio check:

```text
- Plays /audio/HAT.wav.
- Converts typed input to uppercase.
- Accepts exactly HAT before the start-scene voice step is shown.
```

The audio source file is served from:

```text
web/public/audio/HAT.wav
```

`PhaseController.jsx` owns the current welcome/practice state. It now uses two speech contexts:

```js
const START_SCENE_CONTEXT = {
  phase: "practice_calibration",
  flowStep: "welcome_scene_start"
};

const ROBOT_GREETING_CONTEXT = {
  phase: "practice_calibration",
  flowStep: "welcome_robot_greeting"
};
```

When the start-scene decision is approved, the frontend hides the voice input controls and removes the Unity cover. When Unity reports `welcome_robot_greeting_ready`, the frontend shows the voice input controls again with `flowStep: "welcome_robot_greeting"`. When the greeting decision is approved, the frontend covers Unity with the completion message and right-arrow button.

`VoiceRecorder.jsx` uses browser APIs:

```text
navigator.mediaDevices.getUserMedia()
navigator.mediaDevices.enumerateDevices()
MediaRecorder
AudioContext / AnalyserNode for the volume meter
```

The current recording interaction is click-based:

```text
Start voice input
Stop voice input and send
Sending to robot...
```

This was chosen over long-press recording because it is easier for participants in an experiment setting and less likely to conflict with Unity keyboard/mouse control.

`web/src/experiment/api.js` sends recorded audio to:

```text
POST http://127.0.0.1:3001/api/speech/turn
```

Set `VITE_API_BASE_URL` only if the backend URL changes.

## Unity WebGL Integration

The current welcome page loads the WebGL build from:

```text
web/public/unity/Welcome_Scene
```

The source exported build currently lives at:

```text
unity/WebGLBuild/Welcome_Scene
```

Current files expected by `UnityContainer.jsx`:

```text
web/public/unity/Welcome_Scene/Build/Welcome_Scene.loader.js
web/public/unity/Welcome_Scene/Build/Welcome_Scene.data.br
web/public/unity/Welcome_Scene/Build/Welcome_Scene.framework.js.br
web/public/unity/Welcome_Scene/Build/Welcome_Scene.wasm.br
web/public/unity/Welcome_Scene/TemplateData/
```

Current Unity config in the frontend:

```js
const UNITY_BASE_PATH = "/unity/Welcome_Scene";
const UNITY_BUILD_PATH = `${UNITY_BASE_PATH}/Build`;
const UNITY_LOADER_URL = `${UNITY_BUILD_PATH}/Welcome_Scene.loader.js`;
const UNITY_CONFIG = {
  arguments: [],
  dataUrl: `${UNITY_BUILD_PATH}/Welcome_Scene.data.br`,
  frameworkUrl: `${UNITY_BUILD_PATH}/Welcome_Scene.framework.js.br`,
  codeUrl: `${UNITY_BUILD_PATH}/Welcome_Scene.wasm.br`,
  streamingAssetsUrl: `${UNITY_BASE_PATH}/StreamingAssets`,
  companyName: "DefaultCompany",
  productName: "Welcome_Scene",
  productVersion: "0.1"
};
```

If a new Unity WebGL build has a different build folder name or file prefix, update these constants.

`web/vite.config.js` includes custom headers for Unity Brotli files:

```text
.wasm.br -> Content-Encoding: br, Content-Type: application/wasm
.js.br   -> Content-Encoding: br, Content-Type: application/javascript
.data.br -> Content-Encoding: br, Content-Type: application/octet-stream
```

Without these headers, Unity compressed WebGL builds may fail to load in the browser.

The current `Welcome_Scene.data.br` is about 279 MB. For smoother local testing and deployment, future Unity builds should try to stay much smaller if possible.

Unity-to-web events are implemented through:

```text
unity/UnityProject/RoomTour_Feedback_Experiment/Assets/Scripts/WebHostBridge.cs
unity/UnityProject/RoomTour_Feedback_Experiment/Assets/Plugins/WebGL/ExperimentWebBridge.jslib
```

The current welcome event sent by Unity is:

```json
{
  "type": "welcome_robot_greeting_ready",
  "timestampUnity": 12.34
}
```

## Backend Implementation Notes

Important files:

```text
server/src/index.js
server/src/routes/speech.js
server/src/services/openaiSpeechService.js
server/src/services/robotDecisionService.js
server/src/prompts/welcome_scene_start_prompt.txt
server/src/prompts/welcome_robot_greeting_prompt.txt
```

Current speech endpoint:

```text
POST /api/speech/turn
multipart/form-data
  audio: participant-audio.webm or participant-audio.mp4
  phase: practice_calibration
  flowStep: welcome_scene_start or welcome_robot_greeting
```

Current backend response shape:

```json
{
  "turnId": "turn_...",
  "context": {
    "phase": "practice_calibration",
    "flowStep": "welcome_scene_start"
  },
  "transcript": "start the scene",
  "decision": {
    "flowStep": "welcome_scene_start",
    "answer": "Yes",
    "approved": true,
    "intent": "start_scene",
    "feedback": ""
  }
}
```

The current welcome prompt should return exactly:

```text
Yes
```

or:

```text
No
```

No extra explanation should be returned for this first welcome command.

`welcome_robot_greeting_prompt.txt` follows the same `Yes`/`No` output rule and accepts greetings such as `hi`, `hello`, `hi Aria`, `hello Aria`, and similar greetings to the robot.

Session and questionnaire endpoints:

```text
POST /api/experiment/session/start
  body:
    currentFlowStep
    conditionId
  response:
    participantId
    participantCode
    conditionId
    sessionId
    currentFlowStep
    sessionStatus
    startedAt
    lastSeenAt

POST /api/experiment/session/resume
  body:
    participantId
    sessionId

POST /api/questionnaires/submission
  For the current pre-experiment questionnaire, writes one wide row to
  pre_experiment_questionnaire and updates experiment_sessions.current_flow_step
  when nextFlowStep is provided.
```

Important backend files for this flow:

```text
server/src/routes/experiment.js
server/src/routes/questionnaires.js
server/src/services/sessionService.js
server/src/services/dataLogger.js
server/src/services/supabaseService.js
```

`sessionService.js` creates:

```text
participants.id            UUID generated by Supabase
participants.participant_code
experiment_sessions.id     UUID generated by Supabase
```

`participant_code` currently has this shape:

```text
P-{base36 timestamp}-{6 hex random chars}
```

Each table's `id` is that table's own row primary key. Cross-table linkage uses:

```text
experiment_sessions.participant_id -> participants.id
pre_experiment_questionnaire.participant_id -> participants.id
pre_experiment_questionnaire.session_id -> experiment_sessions.id
```

## Supabase Database Notes

Supabase schema is managed with local CLI migrations:

```text
supabase/migrations/
  20260505100000_create_experiment_tables.sql
  20260505103000_create_pre_experiment_questionnaire.sql
  20260505104500_drop_generic_questionnaire_tables.sql
  20260513190000_create_room_tour_results.sql
```

The root project has Supabase CLI installed as a local dev dependency. Useful
commands:

```text
npx supabase login
npx supabase link --project-ref vdbrblyfsplbsyggfwjj
npx supabase db push
```

The current active tables are:

```text
participants
  One row per anonymous participant.

experiment_sessions
  One row per browser experiment session. Refreshing the same browser page
  resumes the same session through localStorage and /session/resume.

pre_experiment_questionnaire
  One row per participant for the pre-experiment questionnaire. This is a wide
  table designed to look like a traditional questionnaire export.

room_tour_results
  One row per session for final Room Tour results. The row is written only
  after the Room Tour completion condition is reached and the frontend
  successfully calls /api/room-tour/complete.
```

The old generic questionnaire tables were removed:

```text
questionnaire_submissions
questionnaire_answers
```

For the current pre-experiment questionnaire, `pre_experiment_questionnaire`
stores columns such as:

```text
age
gender
gender_self_description
robot_types
other_robot_type
robot_vacuum_experience
smart_home_robot_experience
delivery_robot_experience
robotic_arm_experience
educational_robot_experience
other_robot_experience
attitude_good_idea
attitude_life_interesting
attitude_good_to_use
attitude_trust_tasks
attitude_rely_tasks
bfi_reserved
bfi_generally_trusting
bfi_lazy
bfi_relaxed_handles_stress
bfi_few_artistic_interests
bfi_outgoing_sociable
bfi_finds_fault
bfi_thorough_job
bfi_nervous_easily
bfi_active_imagination
```

To clear local test data during development, delete from child tables before
parent tables:

```text
pre_experiment_questionnaire
room_tour_results
experiment_sessions
participants
```

## Notes for Welcome Unity Scene Development

The first Unity welcome scene is now implemented enough for local web integration.

Important assumptions for that work:

- The web cover is responsible for blocking interaction before the participant says "start the scene".
- Unity can load behind the cover.
- After the backend approves the command, the frontend removes the cover and focuses the Unity canvas.
- Unity should not request microphone access or call OpenAI.
- The browser button below Unity remains the voice input control for now.
- Keyboard/mouse movement inside Unity may require canvas focus after the cover is removed.
- The camera movement script keeps camera height fixed and uses `CharacterController.Move` when a `CharacterController` is present.
- The camera trigger script handles meeting Aria: entering `Interaction_Trigger` disables movement, turns the camera toward the target, starts the Animator, plays the assigned audio after a delay, shows the second Unity text, and reports `welcome_robot_greeting_ready` to the web page.

Current relevant Unity scripts:

```text
Assets/Scripts/FixedHeightCameraController.cs
Assets/Scripts/CameraInteractionTrigger.cs
Assets/Scripts/WebHostBridge.cs
Assets/Plugins/WebGL/ExperimentWebBridge.jslib
```

When a new Unity build is exported, copy `unity/WebGLBuild/Welcome_Scene` into `web/public/unity/Welcome_Scene` and verify that the frontend constants still match the Unity file prefix.

## Unity Texture Size Cap Tool

The RoomTour Unity project includes an Editor utility at:

```text
unity/UnityProject/RoomTour_Feedback_Experiment/Assets/Scripts/Editor/TextureImportBatchTools.cs
```

In Unity, open:

```text
Tools > Texture Import > Open Size Cap Tool
```

The tool can:

- Record the current texture import settings as a restore baseline.
- Cap selected textures above 512, 1024, 2048, or 4096 down to that size.
- Cap all textures above 512, 1024, 2048, or 4096 down to that size.
- Select the largest likely non-critical textures.
- Select the largest textures overall.
- Halve texture max size for all textures under selected folders, including
  subfolders.
- Restore texture import settings from the saved baseline.

The backup is saved to:

```text
ProjectSettings/TextureImportBatchBackup.json
```

Backup behavior is intentionally conservative: the first recorded settings for
each texture are kept, and later cap runs do not overwrite them. This means the
cap tool can be run multiple times while still allowing restore to the original
recorded baseline.

## Hosted Deployment Notes

Current deployment target:

```text
Render Web Service
GitHub repo: https://github.com/Lesong-Jia/Room_Tour_Website
Production origin: https://room-tour-website.onrender.com
```

Render should use:

```text
Build command: npm run build
Start command: npm start
```

The production Express server serves:

```text
/api/...      backend API
/             React frontend
/unity/...    Unity WebGL files
```

`server/src/index.js` sets the required Unity Brotli headers for `.br` files.

Important deployment rules:

- Do not commit `server/.env`.
- Do not commit `web/dist`; Render rebuilds it.
- Do not commit `unity/UnityProject` or `unity/WebGLBuild`; copy deployable
  WebGL exports into `web/public/unity` instead.
- Before pushing, verify no file under `web/public/unity` exceeds 100 MiB.

Useful check:

```powershell
Get-ChildItem -Recurse web\public\unity -File |
  Where-Object { $_.Length -gt 100MB }
```

## Browser Compatibility Notes

Observed behavior during hosted testing:

- Windows Chrome on a high-performance Windows desktop worked well.
- macOS Safari worked on the tested MacBook where Chrome had issues.
- macOS Chrome showed mesh/vertex fragmentation on one MacBook, but another
  MacBook did not reproduce the issue.
- A temporary `devicePixelRatio: 1` WebGL setting was tested and then removed:
  it did not fix the geometry issue and it reduced visual resolution.

Recommended participant browser guidance:

```text
Windows: Chrome or Edge.
macOS: Safari.
```

If macOS Chrome must be debugged, compare Chrome GPU backend settings through:

```text
chrome://flags
Choose ANGLE graphics backend
```
