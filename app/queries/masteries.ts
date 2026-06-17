import { SupabaseClient } from "@supabase/supabase-js";
import { TopicMastery } from "../types";

// PostgREST returns a to-one embed (e.g. topics(name)) as an object at runtime,
// but supabase-js types it as an array. Normalize defensively across both.
function embeddedName(topics: unknown): string {
  if (Array.isArray(topics)) return topics[0]?.name ?? "";
  return (topics as { name?: string } | null)?.name ?? "";
}

/**
 * Returns one TopicMastery per topic in the course, with mastery derived from
 * the student's attempt counts. Driven from `topics` (LEFT-joined to masteries)
 * so topics the student hasn't attempted still appear with `mastery: null`.
 *
 * Mastery is NOT stored — it is the single-source-of-truth derivation
 * `attempted > 0 ? correct / attempted : null` (a 0–1 float).
 *
 * @param supabase the Supabase client
 * @param studentId the student whose masteries to compute
 * @param courseId the course whose topics to include
 * @returns a list of TopicMastery (one per course topic), or [] on error
 */
export async function getMasteries(
  supabase: SupabaseClient,
  studentId: string,
  courseId: string,
): Promise<TopicMastery[]> {
  const { data, error } = await supabase
    .from("topics")
    .select(
      "id, name, student_topic_masteries!left(problems_attempted, problems_correct, student_id)",
    )
    .eq("course_id", courseId)
    .eq("student_topic_masteries.student_id", studentId);

  if (error || !data) {
    console.error("Error fetching masteries:", error?.message);
    return [];
  }

  return data.map((row) => {
    const mastery = row.student_topic_masteries?.[0];
    const attempted = mastery?.problems_attempted ?? 0;
    const correct = mastery?.problems_correct ?? 0;

    return {
      topicId: row.id,
      name: row.name,
      mastery: attempted > 0 ? correct / attempted : null,
      problemsAttempted: attempted,
      problemsCorrect: correct,
    };
  });
}

/**
 * Records the outcome of one attempt on a topic by incrementing the student's
 * attempt counts. Inserts the row if absent (upsert on the existing
 * `unique_student_topic` constraint). Requires the owner-scoped UPDATE policy
 * from migration 0001.
 *
 * @param supabase the Supabase client
 * @param studentId the student
 * @param topicId the topic attempted
 * @param wasCorrect whether the attempt was correct
 * @returns the updated TopicMastery, or null on error
 */
export async function updateMasteryCounts(
  supabase: SupabaseClient,
  studentId: string,
  topicId: string,
  wasCorrect: boolean,
): Promise<TopicMastery | null> {
  const { data: existing } = await supabase
    .from("student_topic_masteries")
    .select("problems_attempted, problems_correct")
    .eq("student_id", studentId)
    .eq("topic_id", topicId)
    .maybeSingle();

  const attempted = (existing?.problems_attempted ?? 0) + 1;
  const correct = (existing?.problems_correct ?? 0) + (wasCorrect ? 1 : 0);

  const { data, error } = await supabase
    .from("student_topic_masteries")
    .upsert(
      {
        student_id: studentId,
        topic_id: topicId,
        problems_attempted: attempted,
        problems_correct: correct,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "student_id,topic_id" },
    )
    .select("topic_id, problems_attempted, problems_correct, topics(name)")
    .single();

  if (error || !data) {
    console.error("Error updating mastery counts:", error?.message);
    return null;
  }

  return {
    topicId: data.topic_id,
    name: embeddedName(data.topics),
    mastery:
      data.problems_attempted > 0
        ? data.problems_correct / data.problems_attempted
        : null,
    problemsAttempted: data.problems_attempted,
    problemsCorrect: data.problems_correct,
  };
}
