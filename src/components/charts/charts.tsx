"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* Chart colours read the same CSS tokens as the rest of the UI. */
const C = {
  brand: "var(--brand)",
  approved: "var(--success)",
  rejected: "var(--danger)",
  pending: "var(--warning)",
  info: "var(--info)",
  grid: "var(--border)",
  text: "var(--text-muted)",
};
const SERIES = [C.brand, C.info, C.approved, C.pending, C.rejected, "var(--accent)"];

const axis = { stroke: C.text, fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--text)", fontWeight: 600 },
};

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("en-IN", { month: "short" }) + " " + String(y).slice(2);
}

export function MonthlyTrendChart({
  data,
}: {
  data: { month: string; total: number; approved: number; rejected: number; pending: number }[];
}) {
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <div className="h-72 w-full" role="img" aria-label="Monthly travel requests by status for the last 12 months">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" {...axis} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip cursor={{ fill: "var(--surface-muted)" }} {...tooltipStyle} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="approved" name="Approved" stackId="s" fill={C.approved} maxBarSize={36} />
          <Bar dataKey="pending" name="Pending" stackId="s" fill={C.pending} maxBarSize={36} />
          <Bar dataKey="rejected" name="Rejected" stackId="s" fill={C.rejected} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendLineChart({ data }: { data: { month: string; total: number; approved: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Monthly trend of total and approved requests">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" {...axis} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip {...tooltipStyle} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="total" name="Total" stroke={C.brand} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="approved" name="Approved" stroke={C.approved} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data, label }: { data: { name: string; value: number; color?: string }[]; label: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-48 w-48 shrink-0" role="img" aria-label={label}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={total ? data : [{ name: "None", value: 1 }]} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" paddingAngle={total ? 2 : 0} stroke="none">
              {(total ? data : [{ name: "None", value: 1 }]).map((d, i) => (
                <Cell key={i} fill={total ? ("color" in d && d.color) || SERIES[i % SERIES.length] : C.grid} />
              ))}
            </Pie>
            {total > 0 && <Tooltip {...tooltipStyle} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{total}</span>
          <span className="text-xs text-muted">total</span>
        </div>
      </div>
      <ul className="w-full max-w-xs space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color ?? SERIES[i % SERIES.length] }} />
            <span className="flex-1 text-muted">{d.name}</span>
            <span className="font-medium tabular-nums">{d.value}</span>
            <span className="w-10 text-right text-xs text-muted">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HorizontalBarChart({ data, label, valueName = "Requests" }: { data: { name: string; value: number }[]; label: string; valueName?: string }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted">No data yet.</p>;
  return (
    <div className="w-full" style={{ height: Math.max(160, data.length * 36 + 24) }} role="img" aria-label={label}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} horizontal={false} />
          <XAxis type="number" allowDecimals={false} {...axis} />
          <YAxis type="category" dataKey="name" width={120} {...axis} />
          <Tooltip cursor={{ fill: "var(--surface-muted)" }} {...tooltipStyle} />
          <Bar dataKey="value" name={valueName} fill={C.brand} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AdminPerformanceChart({ data }: { data: { name: string; approved: number; rejected: number; pending: number }[] }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted">No decisions yet.</p>;
  return (
    <div className="h-64 w-full" role="img" aria-label="Approvals, rejections and pending requests per admin">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="name" {...axis} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip cursor={{ fill: "var(--surface-muted)" }} {...tooltipStyle} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="approved" name="Approved" fill={C.approved} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="rejected" name="Rejected" fill={C.rejected} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="pending" name="Pending" fill={C.pending} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const STATUS_COLORS = { approved: C.approved, rejected: C.rejected, pending: C.pending };
