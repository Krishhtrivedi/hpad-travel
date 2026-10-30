import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ClipboardList, Clock, XCircle } from "lucide-react";
import { Badge, ButtonLink, Card, CardBody, CardHeader, PageHeader, ReadOnlyField, StatCard } from "@/components/ui";
import { RequestMiniList } from "@/features/dashboard/widgets";
import { LIST_COLUMNS, type ListRow } from "@/features/requests/query";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { formatDate, homeFor } from "@/lib/utils";

/** Employee profile + travel summary, for Admins (assigned only, via RLS) and Super Admin. */
export async function EmployeeProfileView({ viewer, id }: { viewer: Profile; id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", id).eq("role", "employee").maybeSingle();
  if (!data) notFound();
  const e = data as Profile;
  const base = homeFor(viewer.role);

  const [{ data: rows }, { data: admin }] = await Promise.all([
    supabase.from("travel_requests").select(LIST_COLUMNS).eq("employee_id", id).neq("status", "draft").order("submitted_at", { ascending: false }),
    e.assigned_admin_id ? supabase.from("profiles").select("full_name").eq("id", e.assigned_admin_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const list = (rows as ListRow[]) ?? [];
  const count = (s: string) => list.filter((r) => r.status === s).length;

  return (
    <>
      <Link href={viewer.role === "super_admin" ? `${base}/employees` : `${base}/employees`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to employees
      </Link>
      <PageHeader
        title={e.full_name}
        description={`${e.employee_id} · ${e.department ?? "No department"}`}
        actions={<ButtonLink href={`${base}/history?employee=${e.id}`} variant="secondary">Full travel history</ButtonLink>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Requests" value={list.length} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Approved" value={count("approved")} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Rejected" value={count("rejected")} tone="danger" icon={<XCircle className="h-5 w-5" />} />
        <StatCard label="Pending" value={count("pending")} tone="warning" icon={<Clock className="h-5 w-5" />} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Profile" action={e.is_active ? <Badge className="bg-success-soft text-success">Active</Badge> : <Badge>Inactive</Badge>} />
          <CardBody>
            <dl className="grid gap-4">
              <ReadOnlyField label="Email" value={e.email} />
              <ReadOnlyField label="Phone" value={e.phone} />
              <ReadOnlyField label="Department" value={e.department} />
              <ReadOnlyField label="Reporting admin" value={admin?.full_name} />
              <ReadOnlyField label="Member since" value={formatDate(e.created_at)} />
            </dl>
          </CardBody>
        </Card>
        <div className="lg:col-span-2">
          <RequestMiniList title="Recent requests" rows={list.slice(0, 10)} detailBase={`${base}/requests`} showEmployee={false} viewAllHref={`${base}/history?employee=${e.id}`} emptyText="No requests yet" />
        </div>
      </div>
    </>
  );
}
