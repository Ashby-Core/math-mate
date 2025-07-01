import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user profile to determine role
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_role')
    .eq('id', user.id)
    .single()

  if (profile?.user_role === 'teacher') {
    redirect('/dashboard/teacher')
  } else {
    redirect('/dashboard/student')
  }

  return (
    <div>
      <h1>Loading...</h1>
    </div>
  )
}