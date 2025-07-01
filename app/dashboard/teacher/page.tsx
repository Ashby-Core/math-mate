import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

import Navbar from "@/app/components/dashboard/Navbar";

const TeacherPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: courses } = await supabase.from('courses').select('*').eq('teacher', user.id)

  if (!profile) {
    console.error("Profile record not found");
  }

  return (
    <div>
      <Navbar></Navbar>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">
          Hello, {profile.first_name}!
        </h1>
        <p className="text-gray-600 mb-6">Username: {profile?.username}</p>
        
        <div>
          <h2 className="text-xl font-semibold mb-3">Your Courses</h2>
          {courses && courses.length > 0 ? (
            <div className="grid gap-4">
              {courses.map((course, index: number) => (
                <div key={index} className="p-4 border rounded-lg">
                  <h3 className="font-medium">{course.name}</h3>
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
