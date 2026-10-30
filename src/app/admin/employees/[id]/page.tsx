import { EmployeeProfileView } from "@/features/people/employee-profile-view";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Employee" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole(["admin"]);
  const { id } = await params;
  return <EmployeeProfileView viewer={viewer} id={id} />;
}
