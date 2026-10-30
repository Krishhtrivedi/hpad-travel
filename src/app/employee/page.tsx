import { EmployeeDashboard } from "@/features/dashboard/views";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Dashboard" };

export default async function Page() {
  const profile = await requireRole(["employee"]);
  return <EmployeeDashboard profile={profile} />;
}
