import { SupabaseClient } from "@supabase/supabase-js";
import { TopicWeakness } from "../types";

// PostgREST returns a to-one embed (e.g. topics(name)) as an object at runtime,
// but supabase-js types it as an array. Normalize defensively across both.
function embeddedName(topics: unknown): string {
  if (Array.isArray(topics)) return topics[0]?.name ?? "";
  return (topics as { name?: string } | null)?.name ?? "";
}

// student_topic_weaknesses.description is varchar(100); truncate before insert.
export const DESCRIPTION_MAX = 100;

const WEAKNESS_SELECT =
  "id, topic_id, description, observed_count, last_observed, topics(name)";

/**
 * Returns the student's weaknesses for topics in the given course. weaknesses
 * has no course_id, so this joins through topics; the topic name is included.
 *
 * @param supabase the Supabase client
 * @param studentId the student whose weaknesses to fetch
 * @param courseId the course used to scope topics
 * @returns a list of TopicWeakness, or [] on error
 */
export async function getWeaknesses(
  supabase: SupabaseClient,
  studentId: string,
  courseId: string,
): Promise<TopicWeakness[]> {
  const { data, error } = await supabase
    .from("student_topic_weaknesses")
    .select(
      "id, topic_id, description, observed_count, last_observed, topics!inner(course_id, name)",
    )
    .eq("student_id", studentId)
    .eq("topics.course_id", courseId);

  if (error || !data) {
    console.error("Error fetching weaknesses:", error?.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    topicId: row.topic_id,
    name: embeddedName(row.topics),
    description: row.description,
    observedCount: row.observed_count,
    lastObserved: row.last_observed,
  }));
}

/**
 * Returns the student's weaknesses for a single topic, already known by id
 * (unlike getWeaknesses, no course join is needed to scope the query).
 *
 * @param supabase the Supabase client
 * @param studentId the student whose weaknesses to fetch
 * @param topicId the topic to scope to
 * @returns a list of TopicWeakness, or [] on error
 */
export async function getWeaknessesForTopic(
  supabase: SupabaseClient,
  studentId: string,
  topicId: string,
): Promise<TopicWeakness[]> {
  const { data, error } = await supabase
    .from("student_topic_weaknesses")
    .select(WEAKNESS_SELECT)
    .eq("student_id", studentId)
    .eq("topic_id", topicId);

  if (error || !data) {
    console.error("Error fetching weaknesses for topic:", error?.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    topicId: row.topic_id,
    name: embeddedName(row.topics),
    description: row.description,
    observedCount: row.observed_count,
    lastObserved: row.last_observed,
  }));
}

/**
 * Inserts a new weakness for a student+topic. The description is truncated to
 * the column's 100-char cap. Always inserts — semantic dedup lives in the
 * misconception pipeline (MI-2), not here.
 *
 * @param supabase the Supabase client
 * @param studentId the student
 * @param topicId the topic the misconception relates to
 * @param description the short misconception string
 * @returns the inserted TopicWeakness, or null on error
 */
export async function insertWeakness(
  supabase: SupabaseClient,
  studentId: string,
  topicId: string,
  description: string,
): Promise<TopicWeakness | null> {
  const { data, error } = await supabase
    .from("student_topic_weaknesses")
    .insert({
      student_id: studentId,
      topic_id: topicId,
      description: description.slice(0, DESCRIPTION_MAX),
    })
    .select(WEAKNESS_SELECT)
    .single();

  if (error || !data) {
    console.error("Error inserting weakness:", error?.message);
    return null;
  }

  return {
    id: data.id,
    topicId: data.topic_id,
    name: embeddedName(data.topics),
    description: data.description,
    observedCount: data.observed_count,
    lastObserved: data.last_observed,
  };
}

/**
 * Increments observed_count and refreshes last_observed for an existing
 * weakness (used when the misconception pipeline finds a duplicate).
 *
 * Does the increment via the `increment_weakness` SQL function (migration
 * 0006) rather than a SELECT-then-UPDATE in application code: a
 * read-modify-write across two round-trips loses increments when two calls
 * for the same row overlap (both read the same count, both write the same
 * next value) — exactly the condition this detached, concurrency-friendly
 * pipeline is designed to hit. `SET observed_count = observed_count + 1` in a
 * single statement is atomic under Postgres's row lock, so it can't lose an
 * increment that way. The function runs as SECURITY INVOKER (the default),
 * so the owner-scoped UPDATE policy from migration 0001 still applies.
 *
 * @param supabase the Supabase client
 * @param id the weakness row id
 * @returns the updated TopicWeakness, or null on error
 */
export async function incrementWeakness(
  supabase: SupabaseClient,
  id: string,
): Promise<TopicWeakness | null> {
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "increment_weakness",
    { p_weakness_id: id },
  );
  // `returns setof ...` comes back as an array.
  const updated = Array.isArray(rpcData) ? rpcData[0] : rpcData;

  if (rpcError || !updated) {
    console.error("Error incrementing weakness:", rpcError?.message);
    return null;
  }

  // The RPC returns the bare row (no join) — re-select with the topic name
  // embed for the return shape. Not part of the atomic step above: this read
  // only fills in display data, it doesn't need to be atomic with the write.
  const { data, error } = await supabase
    .from("student_topic_weaknesses")
    .select(WEAKNESS_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Error fetching incremented weakness:", error?.message);
    return null;
  }

  return {
    id: data.id,
    topicId: data.topic_id,
    name: embeddedName(data.topics),
    description: data.description,
    observedCount: data.observed_count,
    lastObserved: data.last_observed,
  };
}
