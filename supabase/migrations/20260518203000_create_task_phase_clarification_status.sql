create table if not exists task_phase_clarification_status (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  participant_code text not null,
  session_id uuid not null references experiment_sessions(id) on delete cascade,
  task_id text not null,
  clarified boolean not null default true,
  source text,
  submitted_at_browser timestamptz,
  submitted_at_server timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint task_phase_clarification_status_session_task_unique unique (session_id, task_id)
);

create index if not exists task_phase_clarification_status_participant_id_idx
  on task_phase_clarification_status(participant_id);

create index if not exists task_phase_clarification_status_session_id_idx
  on task_phase_clarification_status(session_id);
