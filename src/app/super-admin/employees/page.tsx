import { PageHeader } from "@/components/ui";
import { UserTable } from "@/components/admin/user-table";
import { getPeople } from "@/features/people/data";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Manage Employees" };

export default async function Page() {
  const me = await requireRole(["super_admin"]);
  const { rows, adminOptions } = await getPeople("employee");
  return (
    <>
      <PageHeader
        title="Manage Employees"
        description="Add employees, assign them to an Admin, and control access. Changing the admin moves their pending requests too."
      />
      <UserTable role="employee" rows={rows} admins={adminOptions} meId={me.id} />
    </>
  );
}
