-- DB-1: index for profile-assembly joins on weaknesses.
-- masteries (student_id, topic_id) is already covered by unique_student_topic.
create index if not exists idx_weaknesses_student_topic
  on public.student_topic_weaknesses (student_id, topic_id);

-- Writes were denied (no UPDATE policy). Add owner-scoped UPDATE.
-- Existing open SELECT/INSERT policies are left untouched (minimal unblock).
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
