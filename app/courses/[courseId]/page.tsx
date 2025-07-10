import { createAssignment } from "@/app/actions/actions";
import AddAssignment from "@/app/components/dashboard/AddAssignment";
import { Course } from "@/app/types";
import { createClient } from "@/utils/supabase/server";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  const supabase = await createClient();

  const { data: courseData } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();
  const course: Course = {
    id: courseData.id,
    createdAt: courseData.created_at,
    teacher: courseData.teacher,
    name: courseData.name,
    code: courseData.code,
  };

  return (
    <div>
      <h1>{course.name}</h1>
      <h2>Course Code: {course.code}</h2>
      <div>
        <h2>Assignments</h2>
        <AddAssignment courseId={course.id} createAssignmentAction={createAssignment} />
      </div>
    </div>
  );
}
