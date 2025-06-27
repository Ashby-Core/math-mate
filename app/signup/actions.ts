'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'

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

  console.log("User and profile created successfully!")

  revalidatePath('/', 'layout')
  redirect('/')
}