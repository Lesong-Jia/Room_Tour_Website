create extension if not exists "pgcrypto";

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  participant_code text not null unique,
  condition_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists experiment_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  current_flow_step text not null default 'pre_experiment_questionnaire',
  status text not null default 'in_progress',
  user_agent text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists questionnaire_submissions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  session_id uuid not null references experiment_sessions(id) on delete cascade,
  questionnaire_id text not null,
  questionnaire_scope text not null,
  phase text not null,
  trial_id text,
  submitted_at_browser timestamptz,
  submitted_at_server timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists questionnaire_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references questionnaire_submissions(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  session_id uuid not null references experiment_sessions(id) on delete cascade,
  questionnaire_scope text not null,
  phase text not null,
  trial_id text,
  question_id text not null,
  export_tag text,
  answer_value jsonb,
  answer_label jsonb,
  other_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists experiment_sessions_participant_id_idx
  on experiment_sessions(participant_id);

create index if not exists questionnaire_submissions_participant_session_idx
  on questionnaire_submissions(participant_id, session_id);

create index if not exists questionnaire_answers_submission_id_idx
  on questionnaire_answers(submission_id);

create index if not exists questionnaire_answers_participant_session_idx
  on questionnaire_answers(participant_id, session_id);
