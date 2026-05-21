"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { CreateAssignmentInput } from "../types";
import { requireUser } from "./auth";

/**
 * Creates a new user in the database using the given form data
 * @param formData the data about the new user to create
 */
export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("first-name") as string;
  const lastName = formData.get("last-name") as string;
  const username = formData.get("username") as string;
  const userRole = formData.get("role") as string;
  const demographic = formData.get("demographic") as string;

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    console.error("Authentication error: ", authError.message);
  }

  if (!authData.user) {
    console.error("Failed to create user");
    redirect("/error");
  }

  // Create profile record
  const profileData = {
    id: authData.user.id,
    first_name: firstName,
    last_name: lastName,
    username,
    demographic,
    user_role: userRole,
  };

  const { error: profileError } = await supabase
    .from("profiles")
    .insert(profileData);

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    console.error(profileError);
    redirect("/error");
  }

  if (userRole === "teacher") {
    const { error: teacherProfileError } = await supabase
      .from("teacher_profiles")
      .insert({
        id: authData.user.id,
        school: null,
      });

    if (teacherProfileError) {
      console.error(
        "Error creating teacher record: ",
        teacherProfileError.message
      );
    }
  } else if (userRole === "student") {
    // TODO: Add page for specifying student's grade level
    const { error: studentProfileError } = await supabase
      .from("student_profiles")
      .insert({
        id: authData.user.id,
        grade_level: null,
      });

    if (studentProfileError) {
      console.error(
        "Error creating student record: ",
        studentProfileError.message
      );
    }
  }

  console.log("User and profile created successfully!");

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Logs a user in using the provided email and password from the form data
 * @param formData the data containing the user's email and password
 */
export async function login(formData: FormData) {
  const supabase = await createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    console.log(error);
    return error.code
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.log(error);
  }

  redirect("/");
}

/**
 * Creates a new course with the provided name and a unique code
 * @param formData the form data containing the name of the course to create
 */
export async function createCourse(formData: FormData) {
  const generateCode = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let code = "";

    for (let i = 0; i < 6; i += 1) {
      const index = Math.floor(Math.random() * chars.length);
      code += chars.charAt(index);
    }

    return code;
  };

  const { supabase, user } = await requireUser()

  const name = formData.get("courseName") as string;
  const randomCode = generateCode();

  const { error } = await supabase
    ?.from("courses")
    .insert({ teacher: user?.id, name, code: randomCode });

  if (error) {
    console.error("Error creating course");
  }
}

/**
 * Creates a new assignment with the given data and course it is a part of
 * @param formData the data containing information about the assignment, including
 *                 its name, due date, description, topics, and problems
 * @param courseId the id of the course the assignment is a part of
 * @returns an object that either contains an error message if the course cannot be created, or an indicator that the course has been
 *          successfully created
 */
export async function createAssignment(assignment: CreateAssignmentInput) {
  const { supabase } = await requireUser()

  console.log(assignment.problems)

  const { error } = await supabase.rpc("create_assignment", {
    course_id_param: assignment.courseId,
    title_param: assignment.title,
    due_date_param: assignment.dueDate,
    description_param: assignment.description,
    problems_param: assignment.problems
  });

  if (error) return { error: error.message }
  return { success: true };
}

/**
 * Enrolls the currently logged-in user (student) into the course with the provided code
 * @param formData the data containing the code of the course to enroll in
 * @returns an object that either contains an error message if the course cannot be created, or an indicator that the course has been
 *          successfully created
 */
export async function enrollInCourse(formData: FormData) {
  const { supabase, user } = await requireUser()

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .eq("code", formData.get("code"))
    .single();

  if (courseError) {
    return { error: courseError.message };
  }

  const { error } = await supabase.from("enrollments").insert({
    profile_id: user.id,
    course_id: course.id,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
