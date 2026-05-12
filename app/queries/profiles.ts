import { SupabaseClient } from "@supabase/supabase-js";

import { Profile } from "@/app/types";

/**
 * Fetches a single profile row by user id and maps it to the Profile type.
 * Returns null on error or if no row is found.
 * @param supabase The supabase client required to fetch the profile
 * @param id The id of the profile to fetch
 * @returns The fetched profile, if it exists, or null otherwise
 */
export async function getProfileById(
  supabase: SupabaseClient,
  id: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Error fetching profile:", error);
    return null;
  }

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    username: data.username,
    userRole: data.user_role,
  };
}
