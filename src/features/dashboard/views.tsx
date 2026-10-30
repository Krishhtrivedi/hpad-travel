import { CheckCircle2, ClipboardList, Clock, FilePlus2, PlaneTakeoff, ShieldCheck, Users, XCircle, CalendarClock } from "lucide-react";
import { AdminPerformanceChart, DonutChart, MonthlyTrendChart } from "@/components/charts/charts";
import { Alert, ButtonLink, Card, CardBody, CardHeader, PageHeader, StatCard } from "@/components/ui";
import type { Profile } from "@/lib/types";
import { getDashboardData } from "./data";
import { RequestMiniList } from "./widgets";

const STATUS_SLICES = (s: { approved: number; pending: number; rejected: number }) => [
  { name: "Approved", value: s.approved, color: "var(--success)" },
  { name: "Pending", value: s.pending, color: "var(--warning)" },
  { name: "Rejected", value: s.rejected, color: "var(--danger)" },
];

function greeting(name: string) {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${part}, ${name.split(" ")[0]}`;
}

export async function SuperAdminDashboard({ profile }: { profile: Profile }) {
  const { stats: s, recent, current, upcoming, error } = await getDashboardData();
  const base = "/super-admin";
  return (
    <>
      <PageHeader
        title={greeting(profile.full_name)}
        description="Company-wide view of travel outside Ahmedabad."
        actions={
          <>
            <ButtonLink href={`${base}/requests/pending`} variant="secondary">Review pending</ButtonLink>
            <ButtonLink href={`${base}/employees`}>Manage employees</ButtonLink>
          </>
        }
      />
      {error && <Alert tone="danger" className="mb-6">Could not load statistics: {error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total employees" value={s.total_employees} hint={`${s.active_employees} active`} icon={<Users className="h-5 w-5" />} href={`${base}/employees`} />
        <StatCard label="Total admins" value={s.total_admins} icon={<ShieldCheck className="h-5 w-5" />} href={`${base}/admins`} />
        <StatCard label="Total travel requests" value={s.total_requests} icon={<ClipboardList className="h-5 w-5" />} tone="info" href={`${base}/requests`} />
        <StatCard label="Pending requests" value={s.pending} icon={<Clock className="h-5 w-5" />} tone="warning" href={`${base}/requests/pending`} />
        <StatCard label="Approved requests" value={s.approved} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" href={`${base}/requests/approved`} />
        <StatCard label="Rejected requests" value={s.rejected} icon={<XCircle className="h-5 w-5" />} tone="danger" href={`${base}/requests/rejected`} />
        <StatCard label="Currently on approved travel" value={s.currently_travelling} icon={<PlaneTakeoff className="h-5 w-5" />} tone="info" hint="Trip dates include today" />
        <StatCard label="Upcoming approved travel" value={s.upcoming} icon={<CalendarClock className="h-5 w-5" />} hint="Departing after today" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Monthly travel statistics" description="Requests by departure month, last 12 months" />
          <CardBody>
            <MonthlyTrendChart data={s.monthly} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Request status" />
          <CardBody>
            <DonutChart data={STATUS_SLICES(s)} label="Requests by status" />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Admin approval performance" description="Decisions on requests assigned to each admin" />
          <CardBody>
            <AdminPerformanceChart data={s.admin_performance} />
          </CardBody>
        </Card>
        <RequestMiniList title="Recent requests" rows={recent} detailBase={`${base}/requests`} viewAllHref={`${base}/requests`} emptyText="No requests yet" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <RequestMiniList title="Currently on approved travel" description="Approved trips whose dates include today" rows={current} detailBase={`${base}/requests`} mode="current" emptyText="Nobody is on approved travel today" />
        <RequestMiniList title="Upcoming approved travel" rows={upcoming} detailBase={`${base}/requests`} mode="upcoming" emptyText="No upcoming approved trips" />
      </div>
    </>
  );
}

export async function AdminDashboard({ profile }: { profile: Profile }) {
  const { stats: s, recent, current, upcoming, error } = await getDashboardData();
  const base = "/admin";
  return (
    <>
      <PageHeader
        title={greeting(profile.full_name)}
        description="Travel requests from the employees who report to you."
        actions={<ButtonLink href={`${base}/requests/pending`}>Review pending ({s.pending})</ButtonLink>}
      />
      {error && <Alert tone="danger" className="mb-6">Could not load statistics: {error}</Alert>}
      {s.pending > 0 && (
        <Alert tone="warning" className="mb-6">
          You have {s.pending} request{s.pending === 1 ? "" : "s"} waiting for a decision.
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned employees" value={s.total_employees} icon={<Users className="h-5 w-5" />} href={`${base}/employees`} />
        <StatCard label="Requests received" value={s.total_requests} icon={<ClipboardList className="h-5 w-5" />} tone="info" href={`${base}/history`} />
        <StatCard label="Pending" value={s.pending} icon={<Clock className="h-5 w-5" />} tone="warning" href={`${base}/requests/pending`} />
        <StatCard label="Upcoming approved travel" value={s.upcoming} icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard label="Approved" value={s.approved} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" href={`${base}/requests/approved`} />
        <StatCard label="Rejected" value={s.rejected} icon={<XCircle className="h-5 w-5" />} tone="danger" href={`${base}/requests/rejected`} />
        <StatCard label="Currently on approved travel" value={s.currently_travelling} icon={<PlaneTakeoff className="h-5 w-5" />} tone="info" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Monthly approval statistics" description="By departure month, last 12 months" />
          <CardBody>
            <MonthlyTrendChart data={s.monthly} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Request status" />
          <CardBody>
            <DonutChart data={STATUS_SLICES(s)} label="Requests by status" />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <RequestMiniList title="Recent requests" rows={recent} detailBase={`${base}/requests`} viewAllHref={`${base}/history`} emptyText="No requests yet" />
        <RequestMiniList title="On approved travel now" rows={current} detailBase={`${base}/requests`} mode="current" emptyText="Nobody is travelling today" />
        <RequestMiniList title="Upcoming approved travel" rows={upcoming} detailBase={`${base}/requests`} mode="upcoming" emptyText="No upcoming trips" />
      </div>
    </>
  );
}

export async function EmployeeDashboard({ profile }: { profile: Profile }) {
  const { stats: s, recent, upcoming, error } = await getDashboardData();
  const base = "/employee";
  return (
    <>
      <PageHeader
        title={greeting(profile.full_name)}
        description="Submit and track your official travel outside Ahmedabad."
        actions={
          <ButtonLink href={`${base}/new-request`}>
            <FilePlus2 className="h-4 w-4" /> New travel request
          </ButtonLink>
        }
      />
      {error && <Alert tone="danger" className="mb-6">Could not load statistics: {error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Requests submitted" value={s.total_requests} icon={<ClipboardList className="h-5 w-5" />} href={`${base}/requests`} />
        <StatCard label="Pending" value={s.pending} icon={<Clock className="h-5 w-5" />} tone="warning" href={`${base}/requests/pending`} />
        <StatCard label="Approved" value={s.approved} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" href={`${base}/requests/approved`} />
        <StatCard label="Rejected" value={s.rejected} icon={<XCircle className="h-5 w-5" />} tone="danger" href={`${base}/requests/rejected`} />
        <StatCard label="Upcoming approved travel" value={s.upcoming} icon={<CalendarClock className="h-5 w-5" />} tone="info" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RequestMiniList title="Recent travel requests" rows={recent} detailBase={`${base}/requests`} showEmployee={false} viewAllHref={`${base}/requests`} emptyText="You haven't submitted any requests yet" />
        </div>
        <RequestMiniList title="Upcoming approved travel" rows={upcoming} detailBase={`${base}/requests`} showEmployee={false} mode="upcoming" emptyText="No upcoming approved trips" />
      </div>
    </>
  );
}
