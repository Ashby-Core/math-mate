"use client";
import { createClient } from "@/utils/supabase/client";

import Navbar from "@/app/components/dashboard/Navbar";
import { useEffect, useState } from "react";
import { Course, Profile } from "@/app/types";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { SupabaseClient, User } from "@supabase/supabase-js";

const TeacherPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient>();
  const [profileData, setProfileData] = useState<Profile>();
  const [courseData, setCourseData] = useState<Course[] | null>([]);
  const [createCourseModalOpen, setCreateCourseModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      setSupabaseClient(supabase);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();
      const { data: courses } = await supabase
        .from("courses")
        .select("*")
        .eq("teacher", user?.id);

      if (!profile) {
        console.error("Profile record not found");
      }

      setProfileData({
        first_name: profile?.first_name,
        last_name: profile?.last_name,
        username: profile?.username,
      });
      setCourseData(courses);
    };

    fetchData();
  }, []);

  const handleOpen = () => {
    setCreateCourseModalOpen(true);
  };

  const handleClose = () => {
    setCreateCourseModalOpen(false);
  };

  const generateCode = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
    let code = ""

    for (let i = 0; i < 6; i += 1) {
      const index = Math.floor(Math.random() * chars.length)
      code += chars.charAt(index);
    }

    return code;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const formJson = Object.fromEntries(formData.entries());
    const name = formJson.courseName;

    const randomCode = generateCode()

    await supabaseClient
      ?.from("courses")
      .insert({ teacher: user?.id, name, code: randomCode });
    handleClose();
  };

  return (
    <div>
      <Navbar></Navbar>
      <div className="p-6">
        <h1 className="text-4xl font-bold mb-4">
          Hello, {profileData?.first_name}!
        </h1>

        <div>
          <div className="flex mb-3">
            <h2 className="text-2xl font-semibold pr-3">Your Courses</h2>
            <div>
              <Button variant="outlined" onClick={handleOpen}>
                + Add Course
              </Button>
              <Dialog open={createCourseModalOpen} onClose={handleClose}>
                <DialogTitle>Add New Course</DialogTitle>
                <DialogContent>
                  <form onSubmit={handleSubmit}>
                    <TextField
                      autoFocus
                      required
                      margin="dense"
                      id="courseName"
                      name="courseName"
                      label="New course name"
                      type="text"
                      fullWidth
                      variant="standard"
                    ></TextField>
                    <DialogActions>
                      <Button onClick={handleClose}>Cancel</Button>
                      <Button type="submit">Create course</Button>
                    </DialogActions>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
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
