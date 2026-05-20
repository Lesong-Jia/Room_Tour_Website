alter table task_phase_trial_results
  add column if not exists phase text not null default 'phase_2_task_phase';

alter table task_phase_trial_results
  drop constraint if exists task_phase_trial_results_session_task_unique;

alter table task_phase_trial_results
  add constraint task_phase_trial_results_session_phase_task_unique
  unique (session_id, phase, task_index);

create index if not exists task_phase_trial_results_phase_idx
  on task_phase_trial_results(phase);
