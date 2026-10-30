import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { getPeople } from "@/features/people/data";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Assigned Employees" };

export default async function Page() {
  await requireRole(["admin"]);
  // RLS returns only employees assigned to this admin.
  const { rows } = await getPeople("employee");
  return (
    <>
      <PageHeader title="Assigned Employees" description="Employees who report to you for travel approval." />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No employees are assigned to you yet" description="The Super Admin assigns employees to admins." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Employee</Th>
                <Th>Department</Th>
                <Th>Phone</Th>
                <Th>Requests</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-muted/60">
                  <Td>
                    <Link href={`/admin/employees/${r.id}`} className="font-medium text-brand hover:underline">
                      {r.full_name}
                    </Link>
                    <div className="text-xs text-muted">
                      {r.employee_id} · {r.email}
                    </div>
                  </Td>
                  <Td>{r.department ?? "—"}</Td>
                  <Td>{r.phone ?? "—"}</Td>
                  <Td>
                    <Link href={`/admin/history?employee=${r.id}`} className="text-brand hover:underline">
                      {r.requests}
                    </Link>
                  </Td>
                  <Td>{r.is_active ? <Badge className="bg-success-soft text-success">Active</Badge> : <Badge>Inactive</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
