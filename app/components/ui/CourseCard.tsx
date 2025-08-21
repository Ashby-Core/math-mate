import { Course } from "@/app/types";
import Link from "next/link";
import React from "react";

interface CourseCardProps {
  key: number;
  course: Course;
}

const CourseCard = ({ course }: CourseCardProps) => {
  return (
    <Link
      className="bg-orange-100 flex p-4 border border-black rounded-2xl shadow-md"
      href={`/courses/${course.id}`}
    >
      <div className="bg-orange-50 w-[40px] h-[40px] p-1 rounded-full flex items-center justify-center">
        <p className=" text-orange-700 font-medium">
          {course.name.charAt(0).toUpperCase()}
        </p>
      </div>
      <div className="ml-4">
        <p className="text-[#1D1B20] font-semibold">{course.name}</p>
        <p>Code: {course.code}</p>
      </div>
    </Link>
  );
};

export default CourseCard;
