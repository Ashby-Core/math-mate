import { SupabaseClient } from "@supabase/supabase-js";
import { UUID } from "crypto";
import { Problem, ProblemListItem } from "@/app/types";

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

// A to-one embed (problems_topics → topics) arrives as an object at runtime but
// is typed as an array by supabase-js. Normalize to a single topic or null.
function embeddedTopic(topics: unknown): { id: UUID; name: string } | null {
  const t = Array.isArray(topics) ? topics[0] : topics;
  return (t as { id: UUID; name: string } | null) ?? null;
}

/**
 * Lists the problems in an assignment for a student-facing problem list,
 * ordered by `order_index`. Each item carries only its id, order, and named
 * topics — `question_content` and `correct_answer` are deliberately NOT
 * selected, so neither the problem stem nor the answer can reach the client.
 *
 * @param supabase the Supabase client
 * @param assignmentId the assignment whose problems to list
 * @returns the problems as lightweight list items, or an empty array on error
 */
export async function getProblemsByAssignment(
  supabase: SupabaseClient,
  assignmentId: string,
): Promise<ProblemListItem[]> {
  const { data, error } = await supabase
    .from("problems")
    .select("id, order_index, problems_topics(topics(id, name))")
    .eq("assignment_id", assignmentId)
    .order("order_index", { ascending: true });

  if (error || !data) {
    console.error("Error fetching problems for assignment:", error?.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    orderIndex: row.order_index,
    topics: (row.problems_topics ?? []).flatMap((pt) => {
      const topic = embeddedTopic(pt.topics);
      return topic ? [{ id: topic.id, name: topic.name }] : [];
    }),
  }));
}
