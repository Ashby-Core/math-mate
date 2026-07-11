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

/**
 * Returns a single assignment by id, or null if it doesn't exist or on error.
 * Used by the assignment page ([assignmentId]) for its header.
 * @param supabase the supabase client
 * @param assignmentId the id of the assignment to fetch
 * @returns the assignment, or null
 */
export async function getAssignmentById(
  supabase: SupabaseClient,
  assignmentId: string,
): Promise<Assignment | null> {
  const { data: row, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();

  if (error || !row) {
    if (error) console.error("Error fetching assignment:", error.message);
    return null;
  }

  return {
    id: row.id,
    courseId: row.course,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    difficulty: row.difficulty,
    createdAt: row.created_at,
  };
}
