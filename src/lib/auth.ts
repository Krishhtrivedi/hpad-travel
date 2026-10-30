import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";
import { homeFor } from "@/lib/utils";

/** The signed-in user's profile, or null. Cached per request. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("auth_user_id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

/**
 * Server-side role gate for pages and layouts. RLS still protects the data;
 * this keeps people out of screens that are not theirs.
 */
export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.is_active) redirect("/login?error=inactive");
  if (!roles.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}

/** Same check for server actions: returns the profile or throws. */
export async function assertRole(roles: Role[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active || !roles.includes(profile.role)) {
    throw new Error("You are not allowed to do this.");
  }
  return profile;
}
