import { PageHeader } from "@/components/ui";
import { UserTable } from "@/components/admin/user-table";
import { getPeople } from "@/features/people/data";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Manage Admins" };

export default async function Page() {
  const me = await requireRole(["super_admin"]);
  const { rows, adminOptions } = await getPeople("admin");
  return (
    <>
      <PageHeader title="Manage Admins" description="Admins approve or reject travel for the employees assigned to them." />
      <UserTable role="admin" rows={rows} admins={adminOptions} meId={me.id} />
    </>
  );
}
