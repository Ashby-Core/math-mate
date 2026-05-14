import { SupabaseClient } from "@supabase/supabase-js";

import { Assignment } from "@/app/types";

/**
 * Returns every assignment belonging to the given course
 * @param supabase the supabase client
 * @param courseId the id of the course whose assignments to fetch
 * @returns a Promise resolving to the list of assignments for the course, or
 *          an empty array on error
 */
export async function getAssignmentsByCourse(
  supabase: SupabaseClient,
  courseId: string,
): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("course", courseId);

  if (error || !data) {
    console.error("Error fetching assignments:", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    courseId: row.course,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    difficulty: row.difficulty,
    createdAt: row.created_at,
  }));
}
