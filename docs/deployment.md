# Deployment Guide

This project is ready to deploy as a single Node web service:

```text
Render web service
  - serves the Express API
  - serves the built React/Vite frontend from web/dist
  - serves Unity WebGL files with the headers Unity needs

Supabase
  - stores participants, sessions, questionnaires, room-tour results, and task results

OpenAI
  - speech transcription and decision prompts through the backend only
```

## Why Not A Simple Static Host

The Unity WebGL assets are too large for the easiest static hosting path.

Current large files include:

```text
web/public/unity/Room_Tour/Build/Room_Tour.data       ~443 MB
web/public/unity/Ex_Stage_1/Build/Ex_Stage_1.data.br  ~372 MB
web/public/unity/Ex_Stage_2/Build/Ex_Stage_2.data.br  ~372 MB
web/public/unity/Welcome_Scene/Build/*.data.br        ~266 MB
```

As of May 2026, Vercel's official limits list static file uploads as 100 MB on
Hobby and 1 GB on Pro. Cloudflare Pages lists a 25 MiB maximum per site asset.
So the fastest practical deployment path is a normal Node web service, or a
separate object-storage/CDN setup for Unity assets.

References:

- Vercel Limits: https://vercel.com/docs/platform/limits/
- Cloudflare Pages Limits: https://developers.cloudflare.com/pages/platform/limits/
- Render Deploys: https://render.com/docs/deploys/

## Production Runtime

The production server uses:

```text
npm run build
npm start
```

`npm run build` installs the nested frontend/backend dependencies and builds
`web/dist`. `npm start` starts the Express server. In production, the frontend
uses same-origin API calls like `/api/speech/turn`, so no public API URL is
needed when the frontend and backend are served by the same service.

## Required Environment Variables

Set these on the hosting service:

```text
OPENAI_API_KEY=
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_DECISION_MODEL=gpt-5.2

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_AUDIO_BUCKET=participant-audio

WEB_ORIGIN=https://your-production-domain.example
```

If frontend and backend use the same production domain, `WEB_ORIGIN` should be
that domain. For local development, `server/.env.example` keeps the localhost
values.

Never put `OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in `web/` files.

## Render Steps

1. Put this project in a Git repository.
2. Because the Unity files are larger than GitHub's normal 100 MiB file limit,
   install Git LFS before committing the Unity builds:

```text
git lfs install
git add .gitattributes
git add web/public/unity unity/WebGLBuild
```

   The added `.gitattributes` file marks Unity build data and WebAssembly files
   for LFS. If the hosting provider does not fetch LFS objects during deploy,
   use object storage/CDN for `web/public/unity` instead.

3. Push the repository.
4. In Render, create a Blueprint from `render.yaml` or create a Web Service manually.
5. Use:

```text
Build command: npm run build
Start command: npm start
Node version: 24.14.1 or newer
```

6. Add the required environment variables.
7. Deploy.
8. Open `/health` first. It should return:

```json
{ "ok": true }
```

9. Open the root URL and run a fresh pilot participant pass.

## Supabase Checklist

Before the hosted pilot, confirm the Supabase project has the migrations in:

```text
supabase/migrations/
```

If the remote database is not up to date, run:

```text
npx supabase link --project-ref <project-ref>
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

Then verify Supabase rows were written to:

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

The current Unity files are deployable on a normal Node service, but they are
large enough to make first-page loading slow. Before formal data collection,
consider reducing Unity build size or moving Unity assets to object storage/CDN
with explicit `Content-Encoding: br` headers for `.br` files.
