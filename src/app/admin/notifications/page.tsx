import { NotificationsView } from "@/features/notifications/notifications-view";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Notifications" };

export default async function Page() {
  const profile = await requireRole(["admin"]);
  return <NotificationsView profile={profile} />;
}
