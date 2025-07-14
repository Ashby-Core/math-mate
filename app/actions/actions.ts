'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'
import { UUID } from 'crypto'

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const firstName = formData.get('first-name') as string;
  const lastName = formData.get('last-name') as string;
  const username = formData.get('username') as string;
  const userRole = formData.get('role') as string;
  const demographic = formData.get('demographic') as string;

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError) {
    console.error("Authentication error: ", authError.message);
  }

  if (!authData.user) {
    return { error: "Failed to create user" };
  }

  // Create profile record
  const profileData = {
    id: authData.user.id,
    first_name: firstName,
    last_name: lastName,
    username,
    demographic,
    user_role: userRole,
  }

  const { error: profileError } = await supabase.from('profiles').insert(profileData);

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { error: 'Failed to create profile: ' + profileError.message }
  }

  if (userRole === 'teacher') {
    const { error: teacherProfileError } = await supabase.from('teacher_profiles').insert({
      id: authData.user.id,
      school: null,
    })

    if (teacherProfileError) {
      console.error("Error creating teacher record: ", teacherProfileError.message)
    }
  }
  else if (userRole === 'student') {
    // TODO: Add page for specifying student's grade level
    const { error: studentProfileError } = await supabase.from('student_profiles').insert({
      id: authData.user.id,
      grade_level: null,
    })

    if (studentProfileError) {
      console.error("Error creating student record: ", studentProfileError.message)
    }
  }

  console.log("User and profile created successfully!")

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    console.log(error);
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.log(error);
  }

  redirect('/')
}

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = formData.get("courseName") as string;
  const randomCode = generateCode();

  const { error } = await supabase
    ?.from("courses")
    .insert({ teacher: user?.id, name, code: randomCode });

  if (error) {
    console.error("Error creating course");
    return { error: error.message };
  }

  return { success: true };
}

export async function createAssignment(formData: FormData, courseId: UUID) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const title = formData.get("title") as string;
  const topicsPlaintext = formData.get("topics") as string;
  const dueDate = formData.get("dueDate");
  const minQuestions = formData.get("minQuestions");
  const maxQuestions = formData.get("maxQuestions");
  
  const { error } = await supabase
    ?.from("assignments")
    .insert({ 
      course: courseId, 
      title, 
      topics: topicsPlaintext.split(","), 
      due_date: dueDate, 
      min_questions: minQuestions, 
      max_questions: maxQuestions 
    });

  if (error) {
    console.error("Error creating course");
    return { error: error.message };
  }

  return { success: true };
}