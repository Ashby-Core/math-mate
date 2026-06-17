-- DB-1: index for profile-assembly joins on weaknesses.
-- masteries (student_id, topic_id) is already covered by unique_student_topic.
create index if not exists idx_weaknesses_student_topic
  on public.student_topic_weaknesses (student_id, topic_id);

-- Writes were denied (no UPDATE policy). Add owner-scoped UPDATE.
drop policy if exists "masteries_update_own" on public.student_topic_masteries;
create policy "masteries_update_own" on public.student_topic_masteries
  for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists "weaknesses_update_own" on public.student_topic_weaknesses;
create policy "weaknesses_update_own" on public.student_topic_weaknesses
  for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- Replace the open INSERT policies (WITH CHECK true) with owner-scoped ones so
-- a user can only write rows attributed to themselves. Prevents poisoning
-- another student's mastery/weakness profile. (SELECT hardening deferred.)
drop policy if exists "Enable insert for authenticated users only" on public.student_topic_masteries;
drop policy if exists "masteries_insert_own" on public.student_topic_masteries;
create policy "masteries_insert_own" on public.student_topic_masteries
  for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists "Enable insert for authenticated users only" on public.student_topic_weaknesses;
drop policy if exists "weaknesses_insert_own" on public.student_topic_weaknesses;
create policy "weaknesses_insert_own" on public.student_topic_weaknesses
  for insert to authenticated
  with check (student_id = auth.uid());
