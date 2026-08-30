-- incrementWeakness previously did SELECT observed_count -> compute +1 in JS
-- -> UPDATE, which loses increments under concurrent calls for the same row
-- (two overlapping wrong answers on the same topic both read the same count
-- and both write the same next value). A single UPDATE ... SET x = x + 1 is
-- atomic under Postgres's row lock, so wrap it in a function the app calls via
-- rpc() instead of doing the read-modify-write in application code.
--
-- SECURITY INVOKER (the default) so the existing owner-scoped UPDATE policy
-- (weaknesses_update_own, migration 0001) still applies -- this does not
-- bypass RLS.
create or replace function public.increment_weakness(p_weakness_id uuid)
returns setof public.student_topic_weaknesses
language sql
set search_path = ''
as $$
  update public.student_topic_weaknesses
  set observed_count = observed_count + 1,
      last_observed = now()
  where id = p_weakness_id
  returning *;
$$;
