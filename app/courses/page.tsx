"use client";

import { createClient } from "@/utils/supabase/client";
import React, { useEffect, useState } from "react";
import { Course } from "../types";
import { useSearchParams } from "next/navigation";

const CoursePage = () => {
  const [course, setCourse] = useState<Course | null>();
  const searchParams = useSearchParams();

  useEffect(() => {
    const fetchData = async () => {
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (!profile) {
        console.error("Profile record not found");
      }

      const { data: course } = await supabase
        .from("courses")
        .select("*")
        .eq("id", searchParams.get("id"))
        .single();

      setCourse({
        id: course?.id,
        createdAt: course?.created_at,
        teacher: course?.teacher,
        name: course?.name,
        code: course?.code,
      });
    };

    fetchData();
  }, [searchParams]);

  return (
    <div>
      <h1>{course?.name}</h1>
    </div>
  );
};

export default CoursePage;
