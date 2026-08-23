-- API-3: a minimal completion summary so a completed session can be resumed
-- for review without the (already-deleted) live conversation transcript. Holds
-- just the final tutor reply from the turn that completed the session — not a
-- full transcript archive, which stays out of scope (see historyCache.ts).
alter table public.tutoring_sessions
  add column if not exists completion_summary text;
