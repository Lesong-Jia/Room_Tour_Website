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
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),

  constraint room_tour_results_session_unique unique (session_id)
);

create index if not exists room_tour_results_participant_id_idx
  on room_tour_results(participant_id);

create index if not exists room_tour_results_session_id_idx
  on room_tour_results(session_id);
