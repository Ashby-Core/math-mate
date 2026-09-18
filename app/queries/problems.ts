import { SupabaseClient } from "@supabase/supabase-js";
import { UUID } from "crypto";
import { Problem, ProblemListItem, TeacherProblemListItem } from "@/app/types";

// PostgREST returns a to-one embed (e.g. assignments(course)) as an object at
// runtime but supabase-js types it as an array. Normalize across both.
function embeddedCourse(assignments: unknown): string | null {
  if (Array.isArray(assignments)) return assignments[0]?.course ?? null;
  return (assignments as { course?: string } | null)?.course ?? null;
}

/**
 * Fetches a single problem by id and the course + assignment it belongs to
 * (course derived via its assignment), in one query. The problem's topics
 * (`tops`) come from the `problems_topics` join table. Returns `null` when
 * the problem doesn't exist, its course can't be resolved, or on error.
 *
 * `correctAnswer` is included for the tutoring brain's use — callers must never
 * forward it to the client (see `app/tutor/responseShape.ts`).
 *
 * @param supabase the Supabase client
 * @param problemId the problem to load
 * @returns the problem plus its courseId and assignmentId, or null
 */
export async function getProblemById(
  supabase: SupabaseClient,
  problemId: string,
): Promise<{ problem: Problem; courseId: string; assignmentId: string } | null> {
  const { data, error } = await supabase
    .from("problems")
    .select(
      "id, question_content, correct_answer, order_index, assignment_id, assignments(course), problems_topics(topic_id)",
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
    assignmentId: data.assignment_id,
  };
}

// A to-one embed (problems_topics → topics) arrives as an object at runtime but
// is typed as an array by supabase-js. Normalize to a single topic or null.
function embeddedTopic(topics: unknown): { id: UUID; name: string } | null {
  const t = Array.isArray(topics) ? topics[0] : topics;
  return (t as { id: UUID; name: string } | null) ?? null;
}

/** Maps a `problems_topics(topics(id, name))` join into named topics, dropping any without a resolvable topic. */
function namedTopics(
  problemsTopics: { topics: unknown }[] | null,
): { id: UUID; name: string }[] {
  return (problemsTopics ?? []).flatMap((pt) => {
    const topic = embeddedTopic(pt.topics);
    return topic ? [{ id: topic.id, name: topic.name }] : [];
  });
}

/**
 * Shared row fetch behind both assignment problem lists: selects `columns`
 * from `problems` for the assignment, ordered by `order_index`. `columns` is
 * generic (rather than typed `string`) so its literal value still flows into
 * supabase-js's select-string parsing — widening it to `string` would erase
 * row typing and force casts in every caller. Returns `null` on error so
 * callers can each report their own empty-array default.
 */
async function fetchProblemsByAssignment<Columns extends string>(
  supabase: SupabaseClient,
  assignmentId: string,
  columns: Columns,
) {
  const { data, error } = await supabase
    .from("problems")
    .select(columns)
    .eq("assignment_id", assignmentId)
    // `id` is a tiebreaker for equal `order_index` values (not DB-constrained
    // to be unique) so ordering — and therefore `getActiveProblemId` — is
    // stable across requests instead of following whatever order Postgres
    // happens to return.
    .order("order_index", { ascending: true })
    .order("id", { ascending: true });

  if (error || !data) {
    console.error("Error fetching problems for assignment:", error?.message);
    return null;
  }

  return data;
}

/**
 * Lists the problems in an assignment, ordered by `order_index`. Each item
 * carries only its id, order, and named topics — `question_content` and
 * `correct_answer` are deliberately NOT selected, so neither the problem stem
 * nor the answer can reach the client.
 *
 * Feeds both the student-facing problem list (display) and, together with
 * `getSessionStatusesByAssignment`, the sequential-unlock gate in
 * `app/tutor/problemLock.ts` (enforcement) — see that file for why this
 * returns `null` rather than `[]` on error: an enforcement caller must be
 * able to tell "no problems" apart from "the query failed" and fail closed,
 * where a display caller can safely collapse `null` to `[]`.
 *
 * @param supabase the Supabase client
 * @param assignmentId the assignment whose problems to list
 * @returns the problems as lightweight list items, or null on error
 */
export async function getProblemsByAssignment(
  supabase: SupabaseClient,
  assignmentId: string,
): Promise<ProblemListItem[] | null> {
  const data = await fetchProblemsByAssignment(
    supabase,
    assignmentId,
    "id, order_index, problems_topics(topics(id, name))",
  );
  if (!data) return null;

  return data.map((row) => ({
    id: row.id,
    orderIndex: row.order_index,
    topics: namedTopics(row.problems_topics),
  }));
}

/**
 * Lists the problems in an assignment for a teacher-facing problem list,
 * ordered by `order_index`. Unlike `getProblemsByAssignment`, this includes
 * `question_content` and `correct_answer` — a teacher already has both from
 * authoring the assignment, so the student-facing firewall doesn't apply here.
 *
 * @param supabase the Supabase client
 * @param assignmentId the assignment whose problems to list
 * @returns the problems with full content, or an empty array on error
 */
export async function getProblemsByAssignmentForTeacher(
  supabase: SupabaseClient,
  assignmentId: string,
): Promise<TeacherProblemListItem[]> {
  const data = await fetchProblemsByAssignment(
    supabase,
    assignmentId,
    "id, question_content, correct_answer, order_index, problems_topics(topics(id, name))",
  );
  if (!data) return [];

  return data.map((row) => ({
    id: row.id,
    orderIndex: row.order_index,
    questionContent: row.question_content,
    correctAnswer: row.correct_answer,
    topics: namedTopics(row.problems_topics),
  }));
}
