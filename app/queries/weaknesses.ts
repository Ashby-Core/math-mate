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
 * weakness (used when the misconception pipeline finds a duplicate). Requires
 * the owner-scoped UPDATE policy from migration 0001.
 *
 * @param supabase the Supabase client
 * @param id the weakness row id
 * @returns the updated TopicWeakness, or null on error
 */
export async function incrementWeakness(
  supabase: SupabaseClient,
  id: string,
): Promise<TopicWeakness | null> {
  const { data: existing, error: fetchError } = await supabase
    .from("student_topic_weaknesses")
    .select("observed_count")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    console.error("Error fetching weakness to increment:", fetchError?.message);
    return null;
  }

  const { data, error } = await supabase
    .from("student_topic_weaknesses")
    .update({
      observed_count: existing.observed_count + 1,
      last_observed: new Date().toISOString(),
    })
    .eq("id", id)
    .select(WEAKNESS_SELECT)
    .single();

  if (error || !data) {
    console.error("Error incrementing weakness:", error?.message);
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
