alter table participants
  add column if not exists condition_assignment_index bigint;

alter table experiment_sessions
  add column if not exists condition_assignment_index bigint;

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
