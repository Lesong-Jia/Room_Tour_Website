create extension if not exists "pgcrypto";

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  participant_code text not null unique,
  condition_id text,
  condition_assignment_index bigint,
  room_tour_condition text,
  task_response_condition text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists experiment_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  current_flow_step text not null default 'pre_experiment_questionnaire',
  status text not null default 'in_progress',
  condition_assignment_index bigint,
  room_tour_condition text,
  task_response_condition text,
  user_agent text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists experiment_sessions_participant_id_idx
  on experiment_sessions(participant_id);

create table if not exists experiment_condition_assignment_counter (
  id boolean primary key default true,
  next_assignment_index bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint experiment_condition_assignment_counter_singleton check (id)
);

insert into experiment_condition_assignment_counter (id, next_assignment_index)
values (true, 0)
on conflict (id) do nothing;

create or replace function assign_experiment_conditions()
returns table (
  assignment_index bigint,
  condition_id text,
  room_tour_condition text,
  task_response_condition text
)
language plpgsql
as $$
declare
  selected_index bigint;
  cycle_index integer;
  room_index integer;
  task_index integer;
  room_tour_conditions text[] := array[
    'no_room_tour',
    'user_lead',
    'robot_lead'
  ];
  task_response_conditions text[] := array[
    'just_ok',
    'explanation',
    'confirmation_first'
  ];
  first_topup_room_tour_conditions text[] := array[
    'no_room_tour',
    'no_room_tour',
    'user_lead',
    'user_lead',
    'user_lead',
    'robot_lead',
    'robot_lead'
  ];
  first_topup_task_response_conditions text[] := array[
    'just_ok',
    'explanation',
    'explanation',
    'confirmation_first',
    'confirmation_first',
    'just_ok',
    'just_ok'
  ];
  remaining_topup_room_tour_conditions text[] := array[
    'no_room_tour',
    'user_lead',
    'robot_lead',
    'robot_lead',
    'robot_lead',
    'robot_lead'
  ];
  remaining_topup_task_response_conditions text[] := array[
    'explanation',
    'confirmation_first',
    'just_ok',
    'explanation',
    'confirmation_first',
    'just_ok'
  ];
begin
  update experiment_condition_assignment_counter
  set
    next_assignment_index = next_assignment_index + 1,
    updated_at = now()
  where id = true
  returning next_assignment_index - 1 into selected_index;

  if selected_index = 0 then
    room_tour_condition := 'no_room_tour';
    task_response_condition := 'just_ok';
  elsif selected_index = 1 then
    room_tour_condition := 'user_lead';
    task_response_condition := 'explanation';
  elsif selected_index = 2 then
    room_tour_condition := 'robot_lead';
    task_response_condition := 'confirmation_first';
  elsif selected_index between 21 and 27 then
    cycle_index := (selected_index - 21)::integer + 1;
    room_tour_condition := first_topup_room_tour_conditions[cycle_index];
    task_response_condition := first_topup_task_response_conditions[cycle_index];
  elsif selected_index between 28 and 33 then
    cycle_index := (selected_index - 28)::integer + 1;
    room_tour_condition := remaining_topup_room_tour_conditions[cycle_index];
    task_response_condition := remaining_topup_task_response_conditions[cycle_index];
  elsif selected_index between 34 and 38 then
    room_tour_condition := 'robot_lead';
    task_response_condition := 'confirmation_first';
  else
    cycle_index := ((selected_index - 3) % 9)::integer;
    room_index := floor(cycle_index / 3)::integer + 1;
    task_index := (cycle_index % 3)::integer + 1;

    room_tour_condition := room_tour_conditions[room_index];
    task_response_condition := task_response_conditions[task_index];
  end if;

  assignment_index := selected_index;
  condition_id := room_tour_condition || ':' || task_response_condition;
  return next;
end;
$$;

create table if not exists pre_experiment_questionnaire (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  participant_code text not null,
  session_id uuid not null references experiment_sessions(id) on delete cascade,
  source_survey_id text,
  submitted_at_browser timestamptz,
  submitted_at_server timestamptz not null default now(),
  age text,
  gender text,
  gender_self_description text,
  robot_types jsonb not null default '[]'::jsonb,
  other_robot_type text,
  robot_vacuum_experience text,
  smart_home_robot_experience text,
  delivery_robot_experience text,
  robotic_arm_experience text,
  educational_robot_experience text,
  other_robot_experience text,
  attitude_good_idea smallint,
  attitude_life_interesting smallint,
  attitude_good_to_use smallint,
  attitude_trust_tasks smallint,
  attitude_rely_tasks smallint,
  bfi_reserved smallint,
  bfi_generally_trusting smallint,
  bfi_lazy smallint,
  bfi_relaxed_handles_stress smallint,
  bfi_few_artistic_interests smallint,
  bfi_outgoing_sociable smallint,
  bfi_finds_fault smallint,
  bfi_thorough_job smallint,
  bfi_nervous_easily smallint,
  bfi_active_imagination smallint,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint pre_experiment_questionnaire_participant_unique unique (participant_id)
);

create index if not exists pre_experiment_questionnaire_session_id_idx
  on pre_experiment_questionnaire(session_id);

create table if not exists room_tour_results (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  participant_code text not null,
  session_id uuid not null references experiment_sessions(id) on delete cascade,
  submitted_at_browser timestamptz,
  submitted_at_server timestamptz not null default now(),
  recorded_items jsonb not null default '[]'::jsonb,
  covered_item_ids jsonb not null default '[]'::jsonb,
  target_answered_item_ids jsonb not null default '[]'::jsonb,
  target_items_status jsonb not null default '{}'::jsonb,
  room_tour_condition text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint room_tour_results_session_unique unique (session_id)
);

create index if not exists room_tour_results_participant_id_idx
  on room_tour_results(participant_id);

create index if not exists room_tour_results_session_id_idx
  on room_tour_results(session_id);

create table if not exists task_phase_trial_results (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  participant_code text not null,
  session_id uuid not null references experiment_sessions(id) on delete cascade,
  phase text not null default 'phase_2_task_phase',
  task_id text not null,
  task_index integer not null,
  task_count integer not null,
  condition text,
  task_response_condition text,
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
  constraint task_phase_trial_results_session_phase_task_unique unique (session_id, phase, task_index)
);

create index if not exists task_phase_trial_results_participant_id_idx
  on task_phase_trial_results(participant_id);

create index if not exists task_phase_trial_results_session_id_idx
  on task_phase_trial_results(session_id);

create index if not exists task_phase_trial_results_task_id_idx
  on task_phase_trial_results(task_id);

create index if not exists task_phase_trial_results_phase_idx
  on task_phase_trial_results(phase);

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

create table if not exists task_phase_clarification_status (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  participant_code text not null,
  session_id uuid not null references experiment_sessions(id) on delete cascade,
  phase text not null default '',
  task_id text not null,
  clarified boolean not null default true,
  source text,
  submitted_at_browser timestamptz,
  submitted_at_server timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint task_phase_clarification_status_session_phase_task_unique unique (session_id, phase, task_id)
);

create index if not exists task_phase_clarification_status_participant_id_idx
  on task_phase_clarification_status(participant_id);

create index if not exists task_phase_clarification_status_session_id_idx
  on task_phase_clarification_status(session_id);

create index if not exists task_phase_clarification_status_phase_idx
  on task_phase_clarification_status(phase);

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
