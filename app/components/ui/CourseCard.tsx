import { Course } from "@/app/types";
import Link from "next/link";
import React from "react";

interface CourseCardProps {
    key: number;
    course: Course;
}

const CourseCard = ({ key, course }: CourseCardProps) => {
  return (
    <div key={key} className="p-4 border rounded-lg">
      <Link
        href={`/courses/${course.id}`}
        className="text-xl font-semibold text-red-700
                  "
      >
        {course.name}
      </Link>
      <p className="text-gray-600">Code: {course.code}</p>
    </div>
  );
};

export default CourseCard;
