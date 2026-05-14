import UserNavbar from "@/app/UserNavbar";
import AddCourse from "@/app/dashboard/teacher/AddCourse";
import { createCourse } from "@/app/queries/actions";
import { requireUser } from "@/app/queries/auth";
import { getCoursesByTeacher } from "@/app/queries/courses";
import { getProfileById } from "@/app/queries/profiles";
import CourseCard from "@/app/dashboard/CourseCard";

const TeacherPage = async () => {
  const { supabase, user } = await requireUser();

  const profile = await getProfileById(supabase, user.id);
  const courses = await getCoursesByTeacher(supabase, user.id);

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
            {courses.length > 0 ? (
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
