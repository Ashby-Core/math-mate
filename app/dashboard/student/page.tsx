import { enrollInCourse } from "@/app/queries/actions";
import { requireUser } from "@/app/queries/auth";
import { getProfileById } from "@/app/queries/profiles";
import UserNavbar from "@/app/UserNavbar";
import CourseCard from "@/app/dashboard/CourseCard";
import EnrollInCourse from "@/app/dashboard/student/EnrollInCourse";
import { Course } from "@/app/types";
import React from "react";

const StudentPage = async () => {
  const { supabase, user } = await requireUser();

  const profile = await getProfileById(supabase, user.id);

  const { data: enrollmentsData, error: enrollmentsError } = await supabase
    .from("enrollments")
    .select("*, courses(*)")
    .eq("student_id", user.id);

  if (enrollmentsError) {
    console.error("Error fetching courses: ", enrollmentsError);
  }

  const coursesEnrolledIn: Course[] | null = enrollmentsData
    ? enrollmentsData.map((entry) => entry.courses)
    : null;

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

export default StudentPage;
