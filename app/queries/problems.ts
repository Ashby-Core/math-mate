import { SupabaseClient } from "@supabase/supabase-js";
import { Problem } from "@/app/types";

// PostgREST returns a to-one embed (e.g. assignments(course)) as an object at
// runtime but supabase-js types it as an array. Normalize across both.
function embeddedCourse(assignments: unknown): string | null {
  if (Array.isArray(assignments)) return assignments[0]?.course ?? null;
  return (assignments as { course?: string } | null)?.course ?? null;
}

/**
 * Fetches a single problem by id and the course it belongs to (derived via its
 * assignment), in one query. The problem's topics (`tops`) come from the
 * `problems_topics` join table. Returns `null` when the problem doesn't exist,
 * its course can't be resolved, or on error.
 *
 * `correctAnswer` is included for the tutoring brain's use — callers must never
 * forward it to the client (see `app/tutor/responseShape.ts`).
 *
 * @param supabase the Supabase client
 * @param problemId the problem to load
 * @returns the problem plus its courseId, or null
 */
export async function getProblemById(
  supabase: SupabaseClient,
  problemId: string,
): Promise<{ problem: Problem; courseId: string } | null> {
  const { data, error } = await supabase
    .from("problems")
    .select(
      "id, question_content, correct_answer, order_index, assignments(course), problems_topics(topic_id)",
    )
    .eq("id", problemId)
    .single();

  if (error || !data) {
    console.error("Error fetching problem:", error?.message);
    return null;
  }

  const courseId = embeddedCourse(data.assignments);
  if (!courseId) {
    console.error("Problem has no resolvable course:", problemId);
    return null;
  }

  const tops = (data.problems_topics ?? []).map(
    (row) => row.topic_id,
  ) as Problem["tops"];

  return {
    problem: {
      id: data.id,
      questionContent: data.question_content,
      correctAnswer: data.correct_answer,
      orderIndex: data.order_index,
      tops,
    },
    courseId,
  };
}
