import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const p = await requireRole(["admin"]);
  return (
    <AppShell user={{ id: p.id, name: p.full_name, email: p.email, role: p.role, employeeId: p.employee_id }}>
      {children}
    </AppShell>
  );
}
