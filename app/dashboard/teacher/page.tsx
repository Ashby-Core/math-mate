'use client'
import { createClient } from "@/utils/supabase/client";

import Navbar from "@/app/components/dashboard/Navbar";
import CreateButton from "@/app/components/dashboard/CreateButton";
import { useEffect, useState } from "react";
import { Course, Profile } from "@/app/types";

const TeacherPage = () => {
  const [profileData, setProfileData] = useState<Profile>();
  const [courseData, setCourseData] = useState<Course[] | null>([]);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
      const { data: courses } = await supabase.from('courses').select('*').eq('teacher', user?.id)

      if (!profile) {
        console.error("Profile record not found");
      }

      setProfileData({
        first_name: profile?.first_name,
        last_name: profile?.last_name,
        username: profile?.username,
      })
      setCourseData(courses)
    }

    fetchData()
  }, [])

  const openCreateCourseModal = () => {
    console.log("Create course?")
  }

  return (
    <div>
      <Navbar></Navbar>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">
          Hello, {profileData?.first_name}!
        </h1>
        
        <div>
            <div className="flex">
                <h2 className="text-xl font-semibold mb-3">Your Courses</h2>
                <CreateButton text="Add Course" onClick={openCreateCourseModal}></CreateButton>
            </div>
          {courseData && courseData.length > 0 ? (
            <div className="grid gap-4">
              {courseData.map((course, index: number) => (
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
