-- DB-4: durable per-problem session state. Holds small resumable state, NOT the
-- conversation transcript (transcript lives in the Redis cache).
create table if not exists public.tutoring_sessions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  problem_id  uuid not null references public.problems(id) on delete cascade,
  phase       text not null default 'intro'
              check (phase in ('intro','gap_check','solve','review')),
  gap_state   jsonb not null default '{}'::jsonb,
  status      text not null default 'active'
              check (status in ('active','completed','abandoned')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_sessions_student_status
  on public.tutoring_sessions (student_id, status);

alter table public.tutoring_sessions enable row level security;

drop policy if exists "sessions_select_own" on public.tutoring_sessions;
create policy "sessions_select_own" on public.tutoring_sessions
  for select to authenticated using (student_id = auth.uid());

drop policy if exists "sessions_insert_own" on public.tutoring_sessions;
create policy "sessions_insert_own" on public.tutoring_sessions
  for insert to authenticated with check (student_id = auth.uid());

drop policy if exists "sessions_update_own" on public.tutoring_sessions;
create policy "sessions_update_own" on public.tutoring_sessions
  for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists "sessions_delete_own" on public.tutoring_sessions;
create policy "sessions_delete_own" on public.tutoring_sessions
  for delete to authenticated using (student_id = auth.uid());
