import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { Pagination } from "@/components/requests/pagination";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AuditLog } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit Logs" };

const PAGE = 25;
const ACTIONS = [
  "request_submitted",
  "request_approved",
  "request_rejected",
  "employee_created",
  "admin_created",
  "assignment_changed",
  "account_activated",
  "account_deactivated",
  "role_changed",
  "profile_updated",
  "password_reset_sent",
];

function describe(log: AuditLog) {
  const n = (log.new_data ?? {}) as Record<string, unknown>;
  const p = (log.previous_data ?? {}) as Record<string, unknown>;
  if (log.entity_type === "travel_request") return String(n.request_number ?? "");
  const name = String(n.full_name ?? p.full_name ?? n.email ?? "");
  if (log.action === "profile_updated") {
    const changed = Object.keys(n).filter((k) => !["updated_at"].includes(k) && JSON.stringify(n[k]) !== JSON.stringify(p[k]));
    return `${name} — ${changed.join(", ")}`;
  }
  return name;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; action?: string }> }) {
  await requireRole(["super_admin"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const action = sp.action && ACTIONS.includes(sp.action) ? sp.action : undefined;

  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("*", { count: "exact" });
  if (action) q = q.eq("action", action);
  const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const logs = (data as AuditLog[]) ?? [];

  return (
    <>
      <PageHeader title="Audit Logs" description="Permanent, read-only record of important activity. Entries cannot be edited or deleted." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/super-admin/audit-logs" className={`rounded-full px-3 py-1 text-xs font-medium ${!action ? "bg-brand text-brand-contrast" : "bg-surface text-muted border border-line"}`}>
          All
        </Link>
        {ACTIONS.map((a) => (
          <Link
            key={a}
            href={`/super-admin/audit-logs?action=${a}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${action === a ? "bg-brand text-brand-contrast" : "border border-line bg-surface text-muted hover:text-ink"}`}
          >
            {a.replace(/_/g, " ")}
          </Link>
        ))}
      </div>
      <Card>
        {logs.length === 0 ? (
          <EmptyState title="No activity recorded" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(l.created_at)}</Td>
                  <Td>{l.actor_name ?? <span className="text-muted">System</span>}</Td>
                  <Td>
                    <Badge>{l.action.replace(/_/g, " ")}</Badge>
                  </Td>
                  <Td>
                    {l.entity_type === "travel_request" && l.entity_id ? (
                      <Link href={`/super-admin/requests/${l.entity_id}`} className="text-brand hover:underline">
                        {describe(l) || "View request"}
                      </Link>
                    ) : (
                      describe(l)
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pages={Math.max(1, Math.ceil((count ?? 0) / PAGE))} total={count ?? 0} pageSize={PAGE} basePath="/super-admin/audit-logs" params={{ action }} />
      </Card>
    </>
  );
}
