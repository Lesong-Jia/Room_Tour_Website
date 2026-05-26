alter table task_phase_clarification_status
  add column if not exists phase text not null default '';

alter table task_phase_clarification_status
  drop constraint if exists task_phase_clarification_status_session_task_unique;

alter table task_phase_clarification_status
  add constraint task_phase_clarification_status_session_phase_task_unique
  unique (session_id, phase, task_id);

create index if not exists task_phase_clarification_status_phase_idx
  on task_phase_clarification_status(phase);
