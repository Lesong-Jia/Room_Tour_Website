# Human-Robot Communication Experiment Project Overview

## 1. Project Goal

This project is an experimental platform for studying human communication preferences and instruction behavior when interacting with a robot in a room-based task.

Participants will access the experiment through a website. The website will embed a Unity WebGL scene that contains the room environment and robot. Participants will speak to the robot during the experiment. Their speech will be recorded in the browser, converted to text through the OpenAI API on the backend, analyzed by the backend, and then used to decide which predefined robot response should be played in Unity.

The current preferred design uses prerecorded robot audio inside Unity. The backend does not need to generate robot speech with text-to-speech. Instead, the backend returns structured action data such as `speechId`, `animation`, `expression`, and optional target object information. The web frontend then sends that action to Unity.

The formal experiment has three main phases, but the full participant flow also includes an initial practice/device calibration stage and questionnaires before, during, and after the formal experiment phases.

## 2. Participant Flow and Experiment Phases

The full participant flow should be treated as a sequence controlled by the web frontend:

```text
Entry / consent
  -> Practice and device calibration
  -> Pre-formal-experiment questionnaire
  -> Formal Phase 1: Room information memory
  -> Formal Phase 2: Room Tour
       -> instruction trial
       -> robot operation
       -> trial questionnaire
       -> repeated for each instruction
       -> Phase 2 end questionnaire
  -> Formal Phase 3: Second instruction and feedback round
       -> instruction trial
       -> robot operation
       -> trial questionnaire
       -> repeated for each instruction
       -> Phase 3 end questionnaire
  -> Final completion / debrief
```

Current implemented and deployable flow:

```text
experiment_notice
  -> welcome / device check
  -> pre_experiment_questionnaire
  -> environment_intro
  -> optional phase_2_room_tour
  -> next_experiment_placeholder / Phase 2 Task Phase / Ex_Stage_1
  -> phase_2_end_questionnaire
  -> phase_3_second_round / Many Days Later transition
  -> phase_3_task_phase / Ex_Stage_2
  -> phase_3_end_questionnaire
  -> completion
```

### Current Launch Configuration

The current deployment is configured for CloudResearch data collection.

- The first welcome notice requires participants to be native or fluent English
  speakers, asks them to use a Windows desktop computer with Chrome, a working
  microphone/headphones/keyboard/mouse, and warns that attention checks may
  affect bonus eligibility.
- The final page displays the CloudResearch completion code `4CAD4C4248`.
- Environment Introduction uses a 5-minute memory timer.
- Participant/session identity is stored in browser localStorage and verified
  against Supabase on refresh. Refreshing a current page keeps the same
  participant/session but clears data submitted for the current page only.
- Speech turns are stored in Supabase:
  - raw audio files in the private `speech-turn-audio` Storage bucket
  - turn rows in `speech_turns`, including transcript, context, model decision,
    flow step, phase, task id, and assigned conditions
- Room Tour results are finalized in `room_tour_results`.
- Task trial results are stored in `task_phase_trial_results`.
- Task clarification marks are stored in `task_phase_clarification_status` with
  a `phase` field so first-day and many-days-later task phases do not overwrite
  each other.

Conditions are assigned server-side by the Supabase function
`assign_experiment_conditions()`:

```text
assignment 0: no_room_tour + just_ok
assignment 1: user_lead + explanation
assignment 2: robot_lead + confirmation_first
assignment 3+: all 9 combinations in repeating order
```

The assignment counter lives in `experiment_condition_assignment_counter`.
Because the assignment happens inside a database update, concurrent new
participants are assigned distinct sequential indices.

### Pre-Experiment Stage: Practice and Device Calibration

Before the formal experiment starts, participants should complete a practice and device calibration stage.

This stage should confirm that:

- The participant can access the website correctly.
- The Unity WebGL scene loads correctly.
- The microphone permission works.
- The browser can record audio.
- The backend can receive a test audio upload.
- OpenAI speech-to-text returns a usable transcript.
- Unity can receive a test command from the frontend.
- The robot can play a sample prerecorded audio clip and animation.

This stage should be logged separately from the formal experiment so practice behavior is not mixed with formal experimental data.

Current implementation status for the first welcome page:

- The participant-facing page is a single horizontal, non-split layout.
- The top section shows the title `Welcome to Our Experiment`, English device/browser instructions, and a small down-arrow cue.
- The Unity WebGL scene loads below the instructions.
- A full-cover web overlay first runs an audio playback check. The participant plays `/audio/HAT.wav`, enters `HAT`, and submits the answer before the voice command stage is shown.
- After the audio check passes, the overlay tells the participant to use the button below and say "start the scene".
- The voice control is outside Unity, directly below the Unity scene.
- The recording interaction is click once to start and click again to stop and send.
- The frontend sends the current context `{ phase: "practice_calibration", flowStep: "welcome_scene_start" }` with the recorded audio.
- The backend transcribes the audio and asks a focused prompt whether the participant said "start the scene" or an equivalent phrase.
- If the backend returns `Yes`, the frontend hides the voice input controls, removes the Unity cover, and focuses the Unity canvas.
- If the backend returns `No`, the frontend keeps the cover and shows guidance to follow the instruction.
- Unity lets the participant move through the welcome scene to meet Aria, then plays Aria's introduction animation and prerecorded audio.
- When Aria's introduction audio finishes, Unity sends `welcome_robot_greeting_ready` to the web frontend.
- The frontend shows the voice input controls again with `{ phase: "practice_calibration", flowStep: "welcome_robot_greeting" }`.
- The backend uses a second prompt to judge whether the participant greeted Aria or the robot.
- If the greeting check returns `Yes`, the frontend covers Unity with a completion message and a right-arrow button.
- The right-arrow button routes to the Personal Background Questionnaire.

The current welcome scene is sufficient for first-pass local calibration. The next frontend step is to flesh out the demographic questionnaire and then route into the formal experiment sequence.

### Pre-Formal-Experiment Questionnaire

After practice and device calibration, participants should complete a questionnaire before entering the formal experiment.

This questionnaire may collect:

- Demographic information, if approved by the study protocol.
- Prior experience with robots, voice assistants, AI tools, or similar systems.
- Baseline attitudes toward robots.
- Baseline trust, comfort, or communication preferences.
- Any device or environment confirmation needed before formal data collection.

This questionnaire should be linked to the participant and session, but it should be marked as `pre_experiment` rather than belonging to a specific instruction trial.

### Formal Phase 1: Room Information Memory

Participants are given room-related information to memorize within 5 minutes.

The website should manage this phase, including:

- Showing room information, object descriptions, spatial relationships, or other study materials.
- Running the 5-minute timer.
- Recording phase start and end times.
- Optionally recording comprehension checks or confidence ratings.
- Moving the participant to the next phase when the timer ends or when the participant proceeds.

Unity does not need to control this phase unless the room information is shown through the Unity scene.

Current implementation status for the Environment Introduction memory page:

- The page appears after the pre-experiment questionnaire is submitted and the
  session flow step becomes `environment_intro`.
- The first screen shows centered instructions with the title
  `Environment Introduction`, subtitle `Memorize Your Home Environment`, and a
  `Start` button.
- The 5-minute countdown starts only after the participant clicks `Start`.
- During the timed memory period, a sticky countdown stays visible while the
  participant scrolls.
- The room information is organized into three sections: Floor Plan, Kitchen and
  Dining Area, and Living Room.
- Each section uses image/text cards. Floor Plan, Kitchen Overview, and Living
  Room Overview are full-width featured image cards.
- The current image assets live in `web/public/environment/`, copied from
  `C:/Users/Lesong/Desktop/Human-Robot Communication/Resources/Room_Introduction_Images`.
- Images keep their original aspect ratios rather than being cropped to a fixed card ratio.
- When the timer reaches 0:00, the room-information sections disappear and a
  centered `Environment Introduction Complete` screen appears.
- The participant must click `Continue` before moving to the next experiment step.
- The next step is the Room Tour page.

### Formal Phase 2: Room Tour

Participants introduce the room information to the robot and then complete a
series of guided task executions.

Current implementation status for the Room Tour page:

- The Room Tour page is now part of the main participant flow after
  Environment Introduction.
- The frontend loads the Unity WebGL build from
  `web/public/unity/Room_Tour`.
- The current Room Tour build uses Brotli-compressed Unity files:
  `Room_Tour.data.br`, `Room_Tour.framework.js.br`, and `Room_Tour.wasm.br`.
- The active Unity command target is `Progress_Manager.HandleHostCommand`.
- The participant clicks a web overlay button to begin the Room Tour. Unity then
  plays the assigned intro clip from `Room_Tour_User_Lead_Process_Manager`.
- Participant movement is locked during intro audio. Voice input appears only
  after Unity reports `room_tour_intro_completed`.
- Participant explanations are transcribed and classified against eight known
  room items:
  trash can, kitchen dining table, coffee machine, cutting board, microwave,
  rag, candle, and shelf/bookshelf.
- The web overlay tells participants to walk to objects they think the robot
  should know about and introduce them using voice input. It shows short
  English summaries of all recordable room details, not only the eight target
  items.
- Duplicate or near-duplicate summaries are suppressed in the web record list.
- The first valid recordable explanation can trigger a fixed confirmation clip;
  later valid explanations use one of three random confirmation clips. Only
  completely unrelated or unrecordable speech triggers the unrelated-response
  clip and is not recorded.
- When the participant first says they are finished introducing the room, the
  system enters a targeted follow-up stage instead of ending the Room Tour.
- Four target follow-up items are tracked: trash can, cutting board, rag, and
  candle. Unity exposes four bools for these items and receives the current
  covered state from the web frontend.
- For any of the four target items not previously covered, Unity fades a black
  image in, teleports the participant and robot to the configured pair of
  positions, fades back, and plays the configured question audio.
- The first targeted question reached in this stage plays a thank-you clip
  before the question clip. Later targeted questions do not repeat that
  thank-you clip.
- If the participant answers the current target question with related content,
  the backend marks that target item as answered and the web record panel is
  updated. If the answer is unrelated, Unity plays that target item's retry
  clip and asks again.
- If all four target items were already covered before the targeted stage,
  Unity skips directly to the final post-target position, plays the thank-you
  clip, and then plays the preference follow-up question.
- After the targeted stage, Unity moves to the configured final position and
  plays the preference follow-up question. User movement is restored after this
  audio. Robot following is reset to wait for the participant's first back-turn
  before it can move again.
- The preference follow-up stage uses its own backend prompt. Meaningful
  preferences or additional room details are recorded. The first valid
  preference response can trigger a fixed clip; later valid preference responses
  use the same three random confirmation clips. Unrelated preference responses
  can trigger a dedicated unrelated-preference clip.
- When the participant says they have nothing else to add in the preference
  stage, the frontend uploads final Room Tour data to Supabase and then routes
  to a full-page Room Tour completion screen.
- Refreshing the Room Tour page clears current-page Room Tour data for that
  session, including `room_tour_results`, Room Tour `speech_turns`, associated
  raw audio files, and the backend's temporary Room Tour progress.

The expected interaction loop for each instruction trial is:

1. The participant speaks to the robot through the website.
2. The web frontend records the participant's audio.
3. The frontend uploads the audio to the backend.
4. The backend calls OpenAI speech-to-text.
5. The backend analyzes the transcript and experiment context.
6. The backend returns a structured robot action.
7. The frontend sends the robot action to Unity.
8. Unity plays the corresponding prerecorded audio, animation, expression, movement, or object highlight.
9. Unity reports completion and relevant events back to the frontend.
10. The frontend/backend records the complete interaction log.
11. The participant completes a trial-level questionnaire for that instruction and robot operation.

After Room Tour, participants enter the Phase 2 Task Phase. This phase uses the
Unity WebGL build at `web/public/unity/Ex_Stage_1`.

Current Task Phase implementation:

- Unity command target: `Progress_Manager.HandleHostCommand`.
- The web frontend displays task instructions and records participant voice
  commands.
- The backend uses task-specific prompts to accept semantically similar
  commands, including imperfect ASR and near-homophones.
- Each task starts after a Unity fade-to-black/fade-in sequence and camera/robot
  start-state setup.
- The robot task animation is held on its final frame; audio fade-out and Unity
  fade-to-black occur before the web trial questionnaire appears.
- Fixed tasks can pause mid-animation through the shared Unity animation event
  `PauseForClarificationQuestion()`.
- Fixed-task clarification status is derived from Room Tour data and from
  clarification answers given during the task round.
- Random tasks are assigned to three conditions:
  `believes_correct_actually_wrong`, `believes_wrong_actually_wrong`, and
  `believes_wrong_actually_correct`.
- Random-task robot response clips are condition-specific and can be arrays; the
  Unity manager randomly selects one non-empty clip from the configured array.
- Task result messages are colored green for success and red for failure.
- Each task ends with four 1-5 ratings: task difficulty for a robot, task danger
  for a robot, interaction experience with this robot, and trust in this robot.

After all Phase 2 tasks are complete, participants complete the Phase 2 end
questionnaire with UEQ-S, NASA-TLX, and Attitudes/Trust items. The questionnaire
is stored in `phase_end_questionnaire_submissions`.

### Formal Phase 3: Second Instruction and Feedback Round

Participants give another round of instructions and receive robot feedback. This phase is intended to study whether user instructions change over time and with experience.

The implemented transition page says:

```text
Many days later, Aria has continued helping you handle household tasks in your home...
```

The participant clicks Continue to enter the second task round. This phase uses
the same web task-flow component as Phase 2 but loads the Unity WebGL build at
`web/public/unity/Ex_Stage_2` and stores trial rows with
`phase: "phase_3_task_phase"`.

For each instruction trial in this phase, the same structure should be used:

1. Participant instruction.
2. Audio recording and speech-to-text.
3. Backend decision.
4. Unity robot action.
5. Unity completion event.
6. Trial-level questionnaire.

After all Phase 3 instruction trials are complete, participants complete the
same phase-end questionnaire format with a many-days-later prompt. Submitting
the questionnaire routes to the final `Experiment Complete` thank-you page.

Important analysis targets may include:

- Whether instructions become shorter or longer.
- Whether users become more explicit.
- Whether users rely more on robot feedback.
- Whether users adapt to perceived robot capability.
- Whether instruction style changes between Phase 2 and Phase 3.

## 3. Recommended Repository Structure

The project should be organized into separate frontend, backend, Unity, and documentation areas.

```text
Experiment_Project/
  web/
    src/
      components/
        AudioPlaybackCheck.jsx
        UnityContainer.jsx
        VoiceRecorder.jsx
        PhaseController.jsx
        RoomTourPage.jsx
        QuestionnairePage.jsx
      experiment/
        api.js
        phases.js
        questionnaires.js
        unityBridge.js
    public/
      audio/
        HAT.wav
      unity/
        Welcome_Scene/
          Build/
          TemplateData/

  server/
    src/
      index.js
      routes/
        speech.js
        experiment.js
        questionnaires.js
        roomTour.js
        unityEvents.js
      services/
        openaiSpeechService.js
        robotDecisionService.js
        supabaseService.js
        dataLogger.js
      prompts/
        welcome_scene_start_prompt.txt
        welcome_robot_greeting_prompt.txt
        room_tour_explanation_prompt.txt
        room_tour_target_answer_prompt.txt
        room_tour_preference_followup_prompt.txt
        robot_decision_prompt.txt
    .env

  unity/
    UnityProject/
    WebGLBuild/

  docs/
    project_overview.md
```

The exact framework can change, but the responsibility boundaries should stay clear:

- `web/` controls the participant-facing experiment flow.
- `server/` protects API keys, calls OpenAI, validates requests, and stores data.
- `unity/` contains the robot, room scene, animations, audio clips, and WebGL build.
- `docs/` keeps project memory, architecture decisions, and experiment notes.

## 4. System Architecture

Recommended high-level architecture:

```text
Participant Browser
  |
  v
Web Frontend
  - experiment pages
  - practice and device calibration
  - phase control
  - timer
  - questionnaires
  - browser recording
  - Unity WebGL embedding
  - Unity communication
  |
  v
Backend API
  - receive audio
  - call OpenAI speech-to-text
  - classify/analyze participant instruction
  - choose robot response action
  - write logs to Supabase
  |
  v
Supabase
  - database rows for structured experiment data
  - storage objects for audio files and optional logs
```

Unity should usually communicate with the web frontend, not directly with OpenAI or Supabase.

```text
Unity WebGL
  <-> Web Frontend
       <-> Backend API
            <-> OpenAI API
            <-> Supabase
```

This keeps Unity focused on the room and robot experience, while the web frontend remains the experiment controller and the backend remains the secure data and AI layer.

## 5. Frontend Responsibilities

The frontend is the central experiment controller.

It should handle:

- Participant entry flow.
- Consent and instruction pages, if needed.
- Participant ID and condition assignment.
- Practice flow and device calibration checks.
- Phase transitions.
- The 5-minute memory timer.
- Browser microphone permission.
- Audio recording.
- Audio upload to the backend.
- Receiving backend robot action decisions.
- Sending commands to Unity.
- Playing or coordinating robot state changes.
- Trial-level questionnaires after each formal instruction and robot operation.
- Phase-end questionnaires after Room Tour and after the second instruction round.
- Pre-formal-experiment questionnaire routing and submission.
- Recording browser timestamps.
- Forwarding Unity events to the backend.
- Routing to final completion or debrief pages.

The frontend should know the current experiment context:

```json
{
  "participantId": "P001",
  "conditionId": "feedback_condition_A",
  "phase": "phase_2",
  "trialId": "trial_03",
  "flowStep": "trial_questionnaire"
}
```

When Unity reports an event, the frontend should attach this context before sending the event to the backend.

## 6. Backend Responsibilities

The backend should be the only place that stores sensitive keys.

It should handle:

- OpenAI API key.
- Supabase service credentials.
- Audio upload endpoints.
- Speech-to-text calls.
- Robot response decision logic.
- Prompt and condition logic.
- Data validation.
- Rate limits or participant-level request limits.
- Experiment log writing.
- Practice and calibration result logging.
- Questionnaire submission validation and storage.
- Uploading participant audio to Supabase Storage.
- Returning structured robot actions to the frontend.

The backend should not need to generate text-to-speech audio in the current design because robot speech is prerecorded and stored in Unity.

Example backend response:

```json
{
  "transcript": "The red chair is next to the desk.",
  "robotAction": {
    "speechId": "phase2_ack_03",
    "animation": "nod",
    "expression": "friendly",
    "targetObjectId": "red_chair",
    "highlightObjectId": "desk"
  },
  "classification": {
    "instructionType": "spatial_description",
    "taskSuccess": true,
    "confidence": 0.86
  }
}
```

## 7. Unity Responsibilities

Unity should be responsible for the embodied interaction experience.

Unity should handle:

- The room scene.
- Robot model.
- Robot animations.
- Robot expressions.
- Prerecorded robot audio clips.
- Object highlighting.
- Robot looking, pointing, moving, or reacting.
- Scene-specific user interactions.
- Reporting Unity events back to the web frontend.

Unity should not store the OpenAI API key. Unity should not directly call OpenAI.

Unity usually should not write directly to Supabase. It may report events to the frontend, and the frontend/backend can store them.

Useful Unity scripts may include:

```text
Assets/Scripts/
  WebGLExperimentBridge.cs
  RobotController.cs
  RobotAudioController.cs
  RobotAnimationController.cs
  RoomObjectRegistry.cs
  UnityEventReporter.cs
  ExperimentSceneController.cs
```

Unity audio clips can be organized by `speechId`, for example:

```text
Assets/Audio/RobotSpeech/
  phase2_ack_01.wav
  phase2_ack_02.wav
  phase2_clarify_01.wav
  phase2_error_01.wav
  phase3_ack_01.wav
```

The backend and Unity should share a stable list of allowed `speechId` values.

## 8. Voice Interaction Flow

The current preferred formal-experiment voice flow:

```text
Participant clicks or holds recording button
  -> Web frontend records audio through browser APIs
  -> Frontend uploads audio to backend
  -> Backend stores audio file, if needed
  -> Backend calls OpenAI speech-to-text
  -> Backend analyzes transcript and current experiment context
  -> Backend returns transcript + robotAction
  -> Frontend sends robotAction to Unity
  -> Unity plays prerecorded audio and animation
  -> Unity reports response_started and response_completed
  -> Frontend shows the trial-level questionnaire for that instruction
  -> Frontend/backend save the complete event timeline
```

The browser recording code belongs in `web/`, not in Unity.

Recommended frontend APIs:

```text
navigator.mediaDevices.getUserMedia()
MediaRecorder
```

For the current welcome page prototype, the button is not press-and-hold. It uses this simpler participant flow:

```text
Click Start voice input
  -> speak
  -> click Stop voice input and send
```

This is the current preferred choice for the experiment interface because it is explicit, works well with microphone permission prompts, and avoids competing with Unity keyboard/mouse controls.

Recommended backend endpoint:

```text
POST /api/speech/turn
```

Example request data:

```text
multipart/form-data
  audio: recorded audio blob
  participantId: P001
  conditionId: feedback_condition_A
  phase: phase_2
  trialId: trial_03
```

Example response data:

```json
{
  "turnId": "turn_abc123",
  "transcript": "Move to the table and look at the red chair.",
  "robotAction": {
    "speechId": "phase2_ack_move_01",
    "animation": "walk_and_nod",
    "expression": "focused",
    "targetObjectId": "table"
  }
}
```

## 9. Unity-Web Communication

The web frontend should be able to send commands to Unity.

Example frontend-to-Unity command:

```js
unityInstance.SendMessage(
  "WebGLExperimentBridge",
  "OnHostCommand",
  JSON.stringify({
    type: "play_robot_response",
    speechId: "phase2_ack_03",
    animation: "nod",
    expression: "friendly",
    targetObjectId: "red_chair"
  })
);
```

Unity should also be able to report events to the web frontend.

The current welcome scene reports this event after Aria's introduction audio finishes:

```json
{
  "type": "welcome_robot_greeting_ready",
  "timestampUnity": 12.34
}
```

Example Unity event:

```json
{
  "type": "robot_response_completed",
  "speechId": "phase2_ack_03",
  "animation": "nod",
  "timestampUnity": 128.42
}
```

The frontend should enrich Unity events before sending them to the backend:

```json
{
  "participantId": "P001",
  "conditionId": "feedback_condition_A",
  "phase": "phase_2",
  "trialId": "trial_03",
  "timestampBrowser": "2026-05-03T14:21:33.512Z",
  "unityEvent": {
    "type": "robot_response_completed",
    "speechId": "phase2_ack_03",
    "animation": "nod",
    "timestampUnity": 128.42
  }
}
```

Recommended event endpoint:

```text
POST /api/experiment/event
```

Recommended questionnaire endpoint:

```text
POST /api/questionnaires/submission
```

The current pre-experiment questionnaire writes one wide row per participant to
`pre_experiment_questionnaire`. Questionnaire submissions should include
`questionnaireScope`, and may also include `phase` and `trialId` when future
questionnaires belong to a formal instruction trial or phase-end response.

## 10. Supabase Data Storage

Supabase can store most or all experiment data.

Use Supabase Database for structured data:

- Participants.
- Experiment sessions.
- Conditions.
- Practice and device calibration results.
- Phase start/end records.
- Trial records.
- Speech transcripts.
- Robot response decisions.
- Unity event metadata.
- Task outcomes.
- Pre-experiment questionnaire rows, currently stored as one wide row per participant in `pre_experiment_questionnaire`.
- Final Room Tour results, currently stored as one row per session in
  `room_tour_results`.
- Future trial-level and phase-end questionnaires.

Use Supabase Storage for files:

- Participant audio recordings.
- Optional exported Unity logs.
- Optional screenshots or diagnostic files.

Unity should not usually write directly to Supabase. The recommended flow is:

```text
Unity event
  -> Web frontend
  -> Backend API
  -> Supabase Database
```

Audio file flow:

```text
Browser recording
  -> Backend API
  -> Supabase Storage
  -> Supabase Database row stores the file path
```

## 11. Suggested Data Model

Initial tables may include:

```text
participants
  id
  participant_code
  condition_id
  created_at
  completed_at

sessions
  id
  participant_id
  started_at
  ended_at
  user_agent
  current_flow_step
  status

pre_experiment_questionnaire
  id
  participant_id
  participant_code
  session_id
  source_survey_id
  submitted_at_browser
  submitted_at_server
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
  metadata
  updated_at

room_tour_results
  id
  participant_id
  participant_code
  session_id
  submitted_at_browser
  submitted_at_server
  recorded_items
  covered_item_ids
  target_answered_item_ids
  target_items_status
  metadata
  updated_at

practice_calibrations
  id
  participant_id
  session_id
  microphone_permission_status
  test_audio_storage_path
  test_transcript
  unity_loaded
  robot_test_action_completed
  passed
  metadata
  created_at

phase_events
  id
  participant_id
  session_id
  phase
  event_type
  timestamp_browser
  metadata

speech_turns
  id
  participant_id
  session_id
  phase
  trial_id
  audio_storage_path
  transcript
  robot_speech_id
  robot_animation
  robot_expression
  target_object_id
  instruction_type
  task_success
  latency_ms
  created_at

unity_events
  id
  participant_id
  session_id
  phase
  trial_id
  event_type
  object_id
  speech_id
  timestamp_unity
  timestamp_browser
  metadata
```

Recommended questionnaire scopes:

```text
pre_experiment
  Questionnaire after practice/device calibration and before formal Phase 1.

trial
  Questionnaire after each formal instruction and completed robot operation.

phase_end
  Questionnaire after the full Room Tour phase and after the full second instruction phase.
```

The schema can be refined once the exact experimental measures and questionnaire instruments are finalized.

Current implementation note: the old generic `questionnaire_submissions` and
`questionnaire_answers` tables were removed after the pre-experiment
questionnaire was changed to the one-row-per-participant wide table.

## 12. Deployment

Current recommended deployment path:

```text
Render Web Service
  - Express backend API
  - React/Vite frontend from web/dist
  - Unity WebGL static files from web/public/unity
  - OpenAI calls
  - Supabase writes

Supabase
  - database
  - optional storage

GitHub
  - deployment repository for web/server/supabase/docs
```

This single-service Render deployment is preferred for the current pilot because
it avoids cross-origin frontend/backend complexity. The Express server serves
`/api/...`, the built frontend, and `/unity/...` from one origin. Unity WebGL
`.br` files are served with explicit Brotli headers.

Current production repository:

```text
https://github.com/Lesong-Jia/Room_Tour_Website
```

Current production origin:

```text
https://room-tour-website.onrender.com
```

The deployable Unity files currently stay below GitHub's 100 MiB hard file
limit, so Git LFS is not used. Raw Unity source projects and raw WebGL export
folders are local-only and ignored by the deployment repository.

If participant volume or global loading speed becomes a bottleneck, the next
deployment improvement would be to move Unity WebGL files to object storage/CDN
while keeping Express on Render.

## 13. Development Order

Recommended implementation sequence from this point:

1. Run a clean pilot pass with a fresh participant/session and verify Supabase
   rows for every phase.
2. Freeze final task IDs, Unity task configs, audio clip assignments, and
   random-condition mappings.
3. Add practice/device-calibration result logging if it is needed for analysis.
4. Add participant audio-file storage and full turn-level transcript logs if
   required by the approved study protocol.
5. Add export/analysis tools for `room_tour_results`,
   `task_phase_trial_results`, and `phase_end_questionnaire_submissions`.
6. Reduce Unity WebGL build size if deployment or loading time becomes a
   bottleneck.
7. Run a hosted pilot on Render and verify Supabase rows for every phase.

## 14. Important Architecture Decisions

- The frontend and backend should be separate folders.
- The frontend controls the experiment flow.
- The full participant flow starts with practice/device calibration before the formal experiment.
- A pre-formal-experiment questionnaire should be completed after calibration.
- The backend protects API keys and stores data.
- Unity is responsible for room and robot embodiment.
- Browser recording belongs in the frontend.
- OpenAI speech-to-text belongs in the backend.
- Robot speech is prerecorded and stored in Unity.
- The backend returns structured robot actions instead of generated robot audio.
- Trial-level questionnaires should appear after each formal instruction and completed robot operation.
- Phase-end questionnaires should appear after Room Tour and after the second instruction round.
- Unity sends events to the frontend.
- The frontend forwards enriched events to the backend.
- Supabase stores structured experiment data and audio files.
- Unity should not directly call OpenAI.
- Unity should usually not directly write to Supabase.

## 15. Notes for Future Conversations

When continuing this project in a new conversation, start by reading this file.

Useful prompt:

```text
Please read docs/project_overview.md and docs/development_notes.md first, then help me continue the Human-Robot Communication experiment project.
```

This file represents the current agreed architecture as of May 2026. It should be updated whenever the experimental design or technical architecture changes.
