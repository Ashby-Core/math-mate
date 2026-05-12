import { enrollInCourse } from "@/app/queries/actions";
import { requireUser } from "@/app/queries/auth";
import { getEnrolledCoursesForStudent } from "@/app/queries/enrollments";
import { getProfileById } from "@/app/queries/profiles";
import UserNavbar from "@/app/UserNavbar";
import CourseCard from "@/app/dashboard/CourseCard";
import EnrollInCourse from "@/app/dashboard/student/EnrollInCourse";
import React from "react";

const StudentPage = async () => {
  const { supabase, user } = await requireUser();

  const profile = await getProfileById(supabase, user.id);
  const coursesEnrolledIn = await getEnrolledCoursesForStudent(
    supabase,
    user.id,
  );

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
          {coursesEnrolledIn.length > 0 ? (
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
