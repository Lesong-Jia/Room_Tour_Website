create table if not exists task_phase_trial_results (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  participant_code text not null,
  session_id uuid not null references experiment_sessions(id) on delete cascade,
  task_id text not null,
  task_index integer not null,
  task_count integer not null,
  condition text,
  outcome text,
  difficulty_rating smallint,
  danger_rating smallint,
  experience_rating smallint,
  trust_rating smallint,
  ratings jsonb not null default '{}'::jsonb,
  submitted_at_browser timestamptz,
  submitted_at_server timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint task_phase_trial_results_session_task_unique unique (session_id, task_index)
);

create index if not exists task_phase_trial_results_participant_id_idx
  on task_phase_trial_results(participant_id);

create index if not exists task_phase_trial_results_session_id_idx
  on task_phase_trial_results(session_id);

create index if not exists task_phase_trial_results_task_id_idx
  on task_phase_trial_results(task_id);
