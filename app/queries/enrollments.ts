import { SupabaseClient } from "@supabase/supabase-js";

import { Course, Profile } from "@/app/types";

/**
 * Fetches every course the given student is enrolled in, via a join on the
 * enrollments table. Returns an empty array on error.
 * @param supabase The supabase client required to fetch the courses
 * @param studentId The id of the student whose enrollments to load
 * @returns The list of courses the student is enrolled in
 */
export async function getEnrolledCoursesForStudent(
  supabase: SupabaseClient,
  studentId: string,
): Promise<Course[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("*, courses(*)")
    .eq("profile_id", studentId);

  if (error || !data) {
    console.error("Error fetching enrolled courses:", error);
    return [];
  }

  return data.map((row) => ({
    id: row.courses.id,
    createdAt: row.courses.created_at,
    teacher: row.courses.teacher,
    name: row.courses.name,
    code: row.courses.code,
  }));
}

/**
 * Fetches every student enrolled in the given course in a single query, joining
 * enrollments → profiles. Returns an empty array on error.
 * @param supabase The supabase client required to fetch the students
 * @param courseId The id of the course whose roster to load
 * @returns The list of student profiles enrolled in the course
 */
export async function getCourseStudents(
  supabase: SupabaseClient,
  courseId: string,
): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("*, profiles(*)")
    .eq("course_id", courseId);

  if (error || !data) {
    console.error("Error fetching course students:", error);
    return [];
  }

  return data
    .filter((row) => row.profiles)
    .map((row) => ({
      id: row.profiles.id,
      firstName: row.profiles.first_name,
      lastName: row.profiles.last_name,
      username: row.profiles.username,
      userRole: row.profiles.user_role,
    }));
}
