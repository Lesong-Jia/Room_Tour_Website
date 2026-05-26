alter table participants
  add column if not exists room_tour_condition text,
  add column if not exists task_response_condition text;

alter table experiment_sessions
  add column if not exists room_tour_condition text,
  add column if not exists task_response_condition text;

alter table room_tour_results
  add column if not exists room_tour_condition text;

alter table task_phase_trial_results
  add column if not exists task_response_condition text;

create table if not exists speech_turns (
  id uuid primary key default gen_random_uuid(),
  turn_id text not null unique,
  participant_id uuid not null references participants(id) on delete cascade,
  participant_code text not null,
  session_id uuid not null references experiment_sessions(id) on delete cascade,
  phase text,
  flow_step text,
  task_id text,
  task_condition text,
  room_tour_condition text,
  task_response_condition text,
  target_item_id text,
  target_item_label text,
  transcript text not null default '',
  decision jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  error_message text,
  audio_storage_bucket text,
  audio_storage_path text,
  audio_original_name text,
  audio_mime_type text,
  audio_size_bytes integer,
  submitted_at_server timestamptz not null default now()
);

create index if not exists speech_turns_participant_id_idx
  on speech_turns(participant_id);

create index if not exists speech_turns_session_id_idx
  on speech_turns(session_id);

create index if not exists speech_turns_flow_step_idx
  on speech_turns(flow_step);

create index if not exists speech_turns_phase_idx
  on speech_turns(phase);
