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

/**
 * API-friendly variant of {@link requireUser}: loads the server client and
 * authenticated user but returns `null` instead of redirecting when there is no
 * session, so route handlers can respond with a 401 JSON error to `fetch`/curl
 * clients rather than serving the login page.
 * @returns the supabase client and user, or `null` if unauthenticated
 */
export async function requireUserApi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return { supabase, user };
}
