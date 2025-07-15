import { createClient } from "@/utils/supabase/server";
import UserNavbar from "@/app/components/layout/UserNavbar";
import { Course, Profile } from "@/app/types";
import { redirect } from "next/navigation";
import AddCourse from "@/app/components/ui/AddCourse";
import { createCourse } from "@/app/actions/actions";
import CourseCard from "@/app/components/ui/CourseCard";

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
    .eq("id", user.id)
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
      <UserNavbar></UserNavbar>
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
                <CourseCard key={index} course={course} />
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
