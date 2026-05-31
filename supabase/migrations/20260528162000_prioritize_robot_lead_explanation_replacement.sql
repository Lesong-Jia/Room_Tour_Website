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
  elsif selected_index = 35 then
    room_tour_condition := 'robot_lead';
    task_response_condition := 'explanation';
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
