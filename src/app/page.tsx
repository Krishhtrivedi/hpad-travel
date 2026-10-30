import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { homeFor } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Role-based redirection after sign-in. */
export default async function Home() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.is_active) redirect("/login?error=inactive");
  redirect(homeFor(profile.role));
}
