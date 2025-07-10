import { createClient } from "@/utils/supabase/server";
import Navbar from "@/app/components/dashboard/Navbar";
import { Course, Profile } from "@/app/types";
import { redirect } from "next/navigation";
import AddCourse from "@/app/components/dashboard/AddCourse";
import Link from "next/link";
import { createCourse } from "@/app/actions/actions";

const TeacherPage = async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  const { data: coursesData, error: coursesError } = await supabase
    .from("courses")
    .select("*")
    .eq("teacher", user?.id);

  if (profileError) {
    console.error("Profile log not found: ", profileError);
  }

  if (coursesError) {
    console.error("Error fetching courses: ", coursesError);
  }

  const profile: Profile | null = profileData
    ? {
        firstName: profileData.first_name,
        lastName: profileData.last_name,
        username: profileData.username,
      }
    : null;
  const courses: Course[] | null = coursesData;

  return (
    <div>
      <Navbar></Navbar>
      <div className="p-6">
        <h1 className="text-4xl font-bold mb-4">
          Hello, {profile?.firstName}!
        </h1>

        <div>
          <div className="flex mb-3">
            <h2 className="text-2xl font-semibold pr-3">Your Courses</h2>
            <AddCourse createCourseAction={createCourse}></AddCourse>
          </div>
          {courses && courses.length > 0 ? (
            <div className="grid gap-4">
              {courses.map((course, index: number) => (
                // TODO: Refactor this into a separate component
                <div key={index} className="p-4 border rounded-lg">
                  <Link
                    href={`/courses/${course.id}`}
                    className="text-xl font-semibold text-red-700
                  "
                  >
                    {course.name}
                  </Link>
                  <p className="text-gray-600">Code: {course.code}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No courses found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherPage;
