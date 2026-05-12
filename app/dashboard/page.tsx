import { redirect } from "next/navigation";

import { requireUser } from "@/app/queries/auth";
import { getProfileById } from "@/app/queries/profiles";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const profile = await getProfileById(supabase, user.id);

  if (profile?.userRole === "teacher") {
    redirect("/dashboard/teacher");
  } else {
    redirect("/dashboard/student");
  }
}
