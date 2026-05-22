# Deployment Guide

Last updated: 2026-05-22.

The current deployment path is a single Render Web Service:

```text
Render Web Service
  - serves the Express API
  - serves the built React/Vite frontend from web/dist
  - serves Unity WebGL files from web/public/unity
  - calls OpenAI from the backend only
  - writes experiment data to Supabase

Supabase
  - participants
  - sessions
  - questionnaires
  - room-tour results
  - task-phase results
```

This is intentionally simpler than splitting frontend and backend across two
hosts. The production site uses one origin for the webpage, Unity files, and
API calls.

## Current Repository

GitHub repository:

```text
https://github.com/Lesong-Jia/Room_Tour_Website
```

The deployment repository includes:

```text
web/
server/
supabase/migrations/
docs/
package.json
package-lock.json
render.yaml
```

The repository intentionally excludes:

```text
server/.env
node_modules/
web/dist/
supabase/.temp/
unity/UnityProject/
unity/WebGLBuild/
```

Unity source projects and raw Unity export folders stay local. The deployable
Unity WebGL builds are copied into:

```text
web/public/unity/
```

## Current Unity WebGL Build Sizes

The current deployable Unity data files are below GitHub's 100 MiB hard limit:

```text
web/public/unity/Welcome_Scene/Build/Welcome_Scene.data.br  97.00 MiB
web/public/unity/Room_Tour/Build/Room_Tour.data.br          98.06 MiB
web/public/unity/Ex_Stage_1/Build/Ex_Stage_1.data.br        98.43 MiB
web/public/unity/Ex_Stage_2/Build/Ex_Stage_2.data.br        98.40 MiB
```

GitHub may still warn because these files are above the recommended 50 MB
threshold, but push succeeds as long as no single file exceeds 100 MiB.

Before committing new Unity builds, check:

```powershell
Get-ChildItem -Recurse web\public\unity -File |
  Where-Object { $_.Length -gt 100MB } |
  Select-Object FullName,@{Name="MiB";Expression={[math]::Round($_.Length/1MB,2)}}
```

If anything appears in that output, reduce the Unity build before pushing.

## Render Settings

Create a Render Web Service connected to:

```text
Lesong-Jia/Room_Tour_Website
```

Use:

```text
Runtime: Node
Branch: main
Build command: npm run build
Start command: npm start
```

Do not use `npm install; npm run build` as the build command. The root build
script already installs nested frontend/backend dependencies and builds the
frontend.

The root scripts are:

```text
npm run build
  -> npm run install:all
  -> npm --prefix web run build

npm start
  -> npm --prefix server start
```

## Render Environment Variables

Set these in Render's Environment panel:

```text
OPENAI_API_KEY=<secret>
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_DECISION_MODEL=gpt-5.2

SUPABASE_URL=https://vdbrblyfsplbsyggfwjj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret>
SUPABASE_AUDIO_BUCKET=participant-audio

WEB_ORIGIN=https://room-tour-website.onrender.com
NODE_VERSION=24.14.1
```

Do not commit real OpenAI or Supabase service-role keys. The local
`server/.env` file is ignored by Git.

## Production Runtime Behavior

The Express server handles both API routes and static files:

```text
/api/...      backend API
/             React/Vite frontend
/unity/...    Unity WebGL files
```

The production server also sets Unity Brotli headers for `.br` files:

```text
Content-Encoding: br
.wasm.br      -> application/wasm
.js.br        -> application/javascript
.data.br      -> application/octet-stream
```

After deploy, first test:

```text
https://room-tour-website.onrender.com/health
```

Expected response:

```json
{ "ok": true }
```

Then run a complete pilot pass from the root URL.

## Updating Unity Builds

When a new Unity WebGL build is exported locally:

```text
unity/WebGLBuild/Welcome_Scene
unity/WebGLBuild/Room_Tour
unity/WebGLBuild/Ex_Stage_1
unity/WebGLBuild/Ex_Stage_2
```

Copy only the relevant build into:

```text
web/public/unity/<BuildName>
```

Then run:

```powershell
npm --prefix web run build
```

Check that no deployable file exceeds 100 MiB, then commit and push:

```powershell
git add web/public/unity/<BuildName>
git commit -m "Update <BuildName> WebGL build"
git push
```

Render should redeploy automatically after the push.

## Browser Guidance

Current observed compatibility:

```text
Windows Chrome / Edge
  Works well on the tested Windows machine.

macOS Safari
  Works on the tested Mac where Chrome showed geometry artifacts.

macOS Chrome
  Risky on at least one MacBook: some meshes showed vertex/triangle explosion.
  Another MacBook did not show the issue, so this appears device/GPU/backend
  dependent rather than a universal macOS problem.
```

Recommended participant instructions:

```text
Windows participants should use Chrome or Edge.
macOS participants should use Safari.
```

If Mac Chrome must be debugged, test Chrome's ANGLE graphics backend:

```text
chrome://flags
Choose ANGLE graphics backend -> OpenGL / Metal / Default
```

## Render Plan Choice

Do not use Render Free for participant-facing sessions. Free instances can spin
down after inactivity, which creates long cold starts. For small pilot usage
with fewer than about 20 concurrent participants, the lowest paid Web Service
instance is expected to be sufficient because Unity runs in the participant's
browser. Render mainly serves static files, receives audio uploads, calls
OpenAI, and writes Supabase rows.

Monitor Render metrics during pilot runs:

```text
memory usage
CPU
response time
service restarts
```

Upgrade only if memory approaches the instance limit or the service restarts.

## Supabase Checklist

Before hosted testing, confirm the remote Supabase database has the migrations:

```text
supabase/migrations/
```

If needed:

```powershell
npx supabase link --project-ref vdbrblyfsplbsyggfwjj
npx supabase db push
```

## Hosted Pilot Checklist

Run the full flow in a clean browser profile:

```text
Welcome / audio check
Personal Background Questionnaire
Environment Introduction
Room Tour
Phase 2 Task Phase
Phase 2 end questionnaire
Many Days Later transition
Phase 3 Task Phase
Phase 3 end questionnaire
Completion page
```

Verify rows are written to:

```text
participants
experiment_sessions
pre_experiment_questionnaire
room_tour_results
task_phase_trial_results
task_phase_clarification_status
phase_end_questionnaire_submissions
```

## Future Optimization

The current build is deployable without Git LFS, but the Unity files are close
to the 100 MiB limit. Future optimizations may include:

```text
reduce Unity lightmap resolution where possible
cap non-critical decorative textures
remove unused Unity assets from active scenes
move Unity files to object storage/CDN if the experiment scales
```
