import { AdminPerformanceChart, DonutChart, HorizontalBarChart, MonthlyTrendChart, TrendLineChart } from "@/components/charts/charts";
import { Alert, Card, CardBody, CardHeader, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { getDashboardData } from "@/features/dashboard/data";
import type { Profile } from "@/lib/types";
import { TRAVEL_TYPE_LABEL } from "@/lib/utils";

export async function AnalyticsView({ profile }: { profile: Profile }) {
  const { stats: s, error } = await getDashboardData();
  const isSuper = profile.role === "super_admin";
  const decided = s.approved + s.rejected;
  const approvalRate = decided ? Math.round((s.approved / decided) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        description={isSuper ? "Company-wide travel analytics, calculated live from the database." : "Analytics for the employees assigned to you."}
      />
      {error && <Alert tone="danger" className="mb-6">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isSuper && <StatCard label="Employees" value={s.total_employees} />}
        {isSuper && <StatCard label="Admins" value={s.total_admins} />}
        {!isSuper && <StatCard label="Assigned employees" value={s.total_employees} />}
        <StatCard label="Total requests" value={s.total_requests} tone="info" />
        <StatCard label="Approval rate" value={`${approvalRate}%`} tone="success" hint={`${s.approved} approved · ${s.rejected} rejected`} />
        {!isSuper && <StatCard label="Pending" value={s.pending} tone="warning" />}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Monthly travel trend" description="Total vs approved, by departure month" />
          <CardBody>
            <TrendLineChart data={s.monthly} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={isSuper ? "Monthly requests by status" : "Monthly approval statistics"} />
          <CardBody>
            <MonthlyTrendChart data={s.monthly} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Request status" />
          <CardBody>
            <DonutChart
              label="Requests by status"
              data={[
                { name: "Approved", value: s.approved, color: "var(--success)" },
                { name: "Pending", value: s.pending, color: "var(--warning)" },
                { name: "Rejected", value: s.rejected, color: "var(--danger)" },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Flight travel vs site visits" />
          <CardBody>
            <DonutChart
              label="Requests by travel type"
              data={(["flight", "site_visit", "other"] as const).map((t) => ({
                name: TRAVEL_TYPE_LABEL[t],
                value: s.by_type.find((b) => b.type === t)?.total ?? 0,
              }))}
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Top destinations" />
          <CardBody>
            <HorizontalBarChart label="Requests per destination" data={s.top_destinations.map((d) => ({ name: d.destination, value: d.total }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Employee travel frequency" description="Top 10 by number of requests" />
          <CardBody>
            <HorizontalBarChart label="Requests per employee" data={s.employee_frequency.map((e) => ({ name: e.name, value: e.total }))} />
          </CardBody>
        </Card>
      </div>

      {isSuper && (
        <Card className="mt-6">
          <CardHeader title="Admin approval performance" />
          <CardBody>
            <AdminPerformanceChart data={s.admin_performance} />
          </CardBody>
          {/* Mobile Card View for Admin Performance */}
          <div className="divide-y divide-line sm:hidden">
            {s.admin_performance.map((a) => (
              <div key={a.name} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-ink">{a.name}</span>
                  <span className="text-xs font-mono text-muted">Avg: {a.avg_hours != null ? `${a.avg_hours} h` : "—"}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs border-t border-line/50 pt-2">
                  <div>
                    <span className="block text-[10px] font-mono uppercase text-muted">Received</span>
                    <span className="font-medium text-ink">{a.received}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-mono uppercase text-success">Approved</span>
                    <span className="font-semibold text-success">{a.approved}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-mono uppercase text-danger">Rejected</span>
                    <span className="font-semibold text-danger">{a.rejected}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-mono uppercase text-warning">Pending</span>
                    <span className="font-semibold text-warning">{a.pending}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop Table */}
          <div className="hidden sm:block">
            <Table>
              <thead>
                <tr>
                  <Th>Admin</Th>
                  <Th>Received</Th>
                  <Th>Approved</Th>
                  <Th>Rejected</Th>
                  <Th>Pending</Th>
                  <Th>Avg. time to decide</Th>
                </tr>
              </thead>
              <tbody>
                {s.admin_performance.map((a) => (
                  <tr key={a.name}>
                    <Td className="font-medium">{a.name}</Td>
                    <Td>{a.received}</Td>
                    <Td>{a.approved}</Td>
                    <Td>{a.rejected}</Td>
                    <Td>{a.pending}</Td>
                    <Td>{a.avg_hours != null ? `${a.avg_hours} h` : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {s.yearly.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Yearly totals" />
          <Table tableClassName="min-w-full">
            <thead>
              <tr>
                <Th>Year</Th>
                <Th>Requests</Th>
                <Th>Approved</Th>
              </tr>
            </thead>
            <tbody>
              {s.yearly.map((y) => (
                <tr key={y.year}>
                  <Td className="font-medium">{y.year}</Td>
                  <Td>{y.total}</Td>
                  <Td>{y.approved}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
