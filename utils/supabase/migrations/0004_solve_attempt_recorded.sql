-- TS-5: tracks whether this session has already recorded its one live
-- first-solve-attempt mastery write, so later SOLVE_ATTEMPTs in the same
-- session don't write to problem.tops masteries again. A dedicated column
-- (rather than nesting in gap_state) since it's a first-class session
-- lifecycle flag, same as phase/status.
alter table public.tutoring_sessions
  add column if not exists solve_attempt_recorded boolean not null default false;
