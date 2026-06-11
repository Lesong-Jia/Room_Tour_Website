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
begin
  update experiment_condition_assignment_counter
  set
    next_assignment_index = next_assignment_index + 1,
    updated_at = now()
  where id = true
  returning next_assignment_index - 1 into selected_index;

  room_tour_condition := 'user_lead';
  task_response_condition := 'just_ok';
  assignment_index := selected_index;
  condition_id := room_tour_condition || ':' || task_response_condition;
  return next;
end;
$$;
