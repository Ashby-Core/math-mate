-- API-2: at most one active tutoring session per (student, problem). Lets the
-- bootstrap endpoint safely "create or resume" under concurrent requests: a
-- double-submit hits this index and the route falls back to resuming the
-- existing active row. Completed/abandoned rows are unconstrained (re-practice).
create unique index if not exists ux_active_session_per_problem
  on public.tutoring_sessions (student_id, problem_id)
  where status = 'active';
