import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

/**
 * Loads the current Supabase server client and authenticated user, redirecting
 * to /login if no session is present. Returns the client so callers can chain
 * additional queries without re-running cookie binding.
 * @returns an object containing the supabase server client and user. If there is
 * no present session, this function redirects to /login
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}
