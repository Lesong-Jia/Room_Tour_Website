create table if not exists phase_end_questionnaire_submissions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  participant_code text not null,
  session_id uuid not null references experiment_sessions(id) on delete cascade,
  questionnaire_id text not null,
  phase text not null,
  submitted_at_browser timestamptz,
  submitted_at_server timestamptz not null default now(),
  answers jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint phase_end_questionnaire_session_phase_unique unique (session_id, phase)
);

create index if not exists phase_end_questionnaire_participant_id_idx
  on phase_end_questionnaire_submissions(participant_id);

create index if not exists phase_end_questionnaire_session_id_idx
  on phase_end_questionnaire_submissions(session_id);
