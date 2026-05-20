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
