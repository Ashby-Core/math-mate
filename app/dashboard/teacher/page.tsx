import UserNavbar from "@/app/UserNavbar";
import { Course } from "@/app/types";
import AddCourse from "@/app/dashboard/teacher/AddCourse";
import { createCourse } from "@/app/queries/actions";
import { requireUser } from "@/app/queries/auth";
import { getProfileById } from "@/app/queries/profiles";
import CourseCard from "@/app/dashboard/CourseCard";

const TeacherPage = async () => {
  const { supabase, user } = await requireUser();

  const profile = await getProfileById(supabase, user.id);

  const { data: coursesData, error: coursesError } = await supabase
    .from("courses")
    .select("*")
    .eq("teacher", user.id);

  if (coursesError) {
    console.error("Error fetching courses: ", coursesError);
  }

  const courses: Course[] | null = coursesData;

  return (
    <div>
      <UserNavbar />
      <div className="flex p-6 gap-24">
        <div className="w-[60%]">
          <h1 className="text-4xl font-bold mb-4">
            Hello, {profile?.firstName}!
          </h1>
          <div>
            <div className="flex mb-3">
              <h2 className="text-2xl font-semibold pr-3">Your Courses</h2>
              <AddCourse createCourseAction={createCourse} />
            </div>
            {courses && courses.length > 0 ? (
              <div className="flex flex-col gap-4">
                {courses.map((course, index) => (
                  <CourseCard key={index} course={course} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No courses found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherPage;
