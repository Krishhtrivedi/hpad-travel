import { AnalyticsView } from "@/features/analytics/analytics-view";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Analytics" };

export default async function Page() {
  const profile = await requireRole(["super_admin"]);
  return <AnalyticsView profile={profile} />;
}
