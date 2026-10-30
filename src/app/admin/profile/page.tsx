import { ProfileView } from "@/features/profile/profile-view";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Profile" };

export default async function Page() {
  const profile = await requireRole(["admin"]);
  return <ProfileView profile={profile} />;
}
