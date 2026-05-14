import { SupabaseClient } from "@supabase/supabase-js";
import { Course } from "../types";

/**
 * Returns the course with the given id
 * @param supabase the supabase client
 * @param id the id of the course to fetch
 * @returns a Promise object of type Course with the details of the course with the given id
 */
export async function getCourseById(
  supabase: SupabaseClient,
  id: string,
): Promise<Course | null> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Error fetching course")
    return null
  }

  return {
    id: data.id,
    createdAt: data.created_at,
    teacher: data.teacher,
    name: data.name,
    code: data.code,
  }
}

/**
 * Returns every course taught by the given teacher
 * @param supabase the supabase client
 * @param teacherId the id of the teacher whose courses to fetch
 * @returns a Promise resolving to the list of courses the teacher owns, or an
 *          empty array on error
 */
export async function getCoursesByTeacher(
  supabase: SupabaseClient,
  teacherId: string,
): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("teacher", teacherId);

  if (error || !data) {
    console.error("Error fetching courses:", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    teacher: row.teacher,
    name: row.name,
    code: row.code,
  }));
}