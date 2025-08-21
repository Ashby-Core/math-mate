import { enrollInCourse } from "@/app/actions/actions";
import UserNavbar from "@/app/components/layout/UserNavbar";
import CourseCard from "@/app/components/ui/CourseCard";
import EnrollInCourse from "@/app/components/ui/EnrollInCourse";
import { Course, Profile } from "@/app/types";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import React from "react";

const StudentPage = async () => {
  const fetchEnrollments = async (): Promise<Course[] | null> => {
    if (!enrollmentsData) {
      return null;
    }

    const courses: Course[] = [];

    for (let i = 0; i < enrollmentsData.length; i += 1) {
      const currCourseId = enrollmentsData[i].course_id;
      const { data: currCourse } = await supabase
        .from("courses")
        .select("*")
        .eq("id", currCourseId)
        .single();

      courses.push({
        id: currCourseId,
        createdAt: currCourse.created_at,
        teacher: currCourse.teacher,
        name: currCourse.name,
        code: currCourse.code,
      });
    }

    return courses;
  };
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
  const { data: enrollmentsData, error: enrollmentsError } = await supabase
    .from("enrollments")
    .select("*")
    .eq("student_id", user.id);

  if (profileError) {
    console.error("Profile log not found: ", profileError);
  }

  if (enrollmentsError) {
    console.error("Error fetching courses: ", enrollmentsError);
  }

  const profile: Profile | null = profileData
    ? {
        firstName: profileData.first_name,
        lastName: profileData.last_name,
        username: profileData.username,
      }
    : null;
  const coursesEnrolledIn: Course[] | null = await fetchEnrollments();

  return (
    <div>
      <UserNavbar />
      <div className="p-6">
        <h1 className="text-4xl font-bold mb-4">
          Hello, {profile?.firstName}!
        </h1>

        <div>
          <div className="flex mb-3">
            <h2 className="text-2xl font-semibold pr-3">Courses Enrolled In</h2>
            <EnrollInCourse enrollAction={enrollInCourse} />
          </div>
          {coursesEnrolledIn && coursesEnrolledIn.length > 0 ? (
            <div className="grid gap-4">
              {coursesEnrolledIn.map((course, index: number) => (
                <CourseCard index={index} course={course} />
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

export default StudentPage;
