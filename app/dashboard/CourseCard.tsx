import { Course } from "@/app/types";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/app/components/ui/card";

interface CourseCardProps {
  course: Course;
}

const CourseCard = ({ course }: CourseCardProps) => {
  return (
    <Link href={`/courses/${course.id}`}>
      <Card className="bg-orange-100 border border-black hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>{course.name}</CardTitle>
          <CardDescription>Code: {course.code}</CardDescription>
          <CardAction>
            <div className="bg-orange-50 w-10 h-10 rounded-full flex items-center justify-center">
              <span className="text-orange-700 font-medium">
                {course.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </CardAction>
        </CardHeader>
      </Card>
    </Link>
  );
};

export default CourseCard;
