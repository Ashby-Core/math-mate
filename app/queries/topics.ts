import { SupabaseClient } from "@supabase/supabase-js";
import { Topic } from "../types";

/**
 * Returns the available topics for the course with the given course id.
 * @param supabase the Supabase client
 * @param courseId the id of the course used to look for its available topics
 * @returns a list of available topics, or an empty list if there are none
 */
export async function getTopicsByCourse(
  supabase: SupabaseClient,
  courseId: string,
): Promise<Topic[]> {
  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .eq("course_id", courseId);

  if (error || !data) {
    console.error("Error fetching available topics: ", error.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    courseId: row.course_id,
    name: row.name,
    createdAt: row.created_at,
  }));
}
