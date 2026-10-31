"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { fetchReportData, type ReportRow, type ReportType } from "@/app/actions/reports";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { addFooter, autoTable, newDocument, PDF_HEAD_STYLE } from "@/lib/pdf";
import { formatCurrency, formatDate, formatDateTime, STATUS_LABEL, TRAVEL_TYPE_LABEL } from "@/lib/utils";
import type { RequestStatus, TravelType } from "@/lib/types";

const REPORTS: { value: ReportType; label: string; description: string }[] = [
  { value: "history", label: "Complete travel history", description: "Every submitted request in the date range (by departure date)." },
  { value: "employee", label: "Employee travel report", description: "All requests for one employee." },
  { value: "monthly", label: "Monthly travel report", description: "Requests departing in a chosen month." },
  { value: "approvals", label: "Approval report", description: "Approved requests, by decision date." },
  { value: "rejections", label: "Rejection report", description: "Rejected requests with reasons, by decision date." },
  { value: "admin_performance", label: "Admin performance report", description: "Requests received and decided per admin." },
];

type Column = { header: string; width: number; value: (r: ReportRow) => string | number };

const COLUMNS: Column[] = [
  { header: "Request ID", width: 16, value: (r) => r.request_number ?? "" },
  { header: "Employee", width: 22, value: (r) => r.employee_name },
  { header: "Employee ID", width: 12, value: (r) => r.employee_code },
  { header: "Department", width: 16, value: (r) => r.employee_department ?? "" },
  { header: "Travel type", width: 18, value: (r) => TRAVEL_TYPE_LABEL[r.travel_type as TravelType] },
  { header: "Destination", width: 18, value: (r) => [r.destination_city, r.destination_state].filter(Boolean).join(", ") },
  { header: "Purpose", width: 30, value: (r) => r.travel_purpose ?? "" },
  { header: "Departure", width: 13, value: (r) => formatDate(r.departure_date) },
  { header: "Return", width: 13, value: (r) => formatDate(r.return_date) },
  { header: "Est. expenses (INR)", width: 14, value: (r) => (r.estimated_expenses != null ? Number(r.estimated_expenses) : "") },
  { header: "Status", width: 11, value: (r) => STATUS_LABEL[r.status as RequestStatus] },
  { header: "Admin", width: 18, value: (r) => r.assigned_admin_name ?? "" },
  { header: "Decided by", width: 18, value: (r) => r.reviewed_by_name ?? "" },
  { header: "Decided on", width: 18, value: (r) => (r.reviewed_at ? formatDateTime(r.reviewed_at) : "") },
  { header: "Comments / reason", width: 34, value: (r) => r.review_comments ?? "" },
];

function adminPerformance(rows: ReportRow[]) {
  const map = new Map<string, { admin: string; received: number; approved: number; rejected: number; pending: number; hours: number[] }>();
  for (const r of rows) {
    const k = r.assigned_admin_name ?? "Unassigned";
    const a = map.get(k) ?? { admin: k, received: 0, approved: 0, rejected: 0, pending: 0, hours: [] };
    a.received++;
    if (r.status === "approved") a.approved++;
    if (r.status === "rejected") a.rejected++;
    if (r.status === "pending") a.pending++;
    if (r.reviewed_at && r.submitted_at) a.hours.push((new Date(r.reviewed_at).getTime() - new Date(r.submitted_at).getTime()) / 36e5);
    map.set(k, a);
  }
  return [...map.values()].map((a) => ({
    Admin: a.admin,
    Received: a.received,
    Approved: a.approved,
    Rejected: a.rejected,
    Pending: a.pending,
    "Approval rate": a.approved + a.rejected ? `${Math.round((a.approved / (a.approved + a.rejected)) * 100)}%` : "—",
    "Avg. hours to decide": a.hours.length ? (a.hours.reduce((s, h) => s + h, 0) / a.hours.length).toFixed(1) : "—",
  }));
}

export function ReportBuilder({ employees }: { employees: { id: string; label: string }[] }) {
  const [type, setType] = useState<ReportType>("history");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [employee, setEmployee] = useState("");
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);
  const [msg, setMsg] = useState<{ tone: "danger" | "success" | "warning"; text: string } | null>(null);

  const meta = REPORTS.find((r) => r.value === type)!;
  const rangeLabel = type === "monthly" ? month : from || to ? `${from ? formatDate(from) : "start"} – ${to ? formatDate(to) : "today"}` : "All dates";

  const run = async (format: "xlsx" | "pdf") => {
    setBusy(format);
    setMsg(null);
    try {
      const res = await fetchReportData({ type, from, to, month, employee });
      if (!res.ok) throw new Error(res.error);
      const { rows, truncated } = res.data!;
      if (!rows.length) {
        setMsg({ tone: "warning", text: "No records match these options." });
        return;
      }
      const empName = employees.find((e) => e.id === employee)?.label;
      const title = `${meta.label}${type === "employee" && empName ? ` — ${empName}` : ""}`;
      const fileBase = `${BRAND.name}-${type}-report-${new Date().toISOString().slice(0, 10)}`;

      let headers: string[];
      let body: (string | number)[][];
      if (type === "admin_performance") {
        const perf = adminPerformance(rows);
        headers = Object.keys(perf[0]);
        body = perf.map((p) => Object.values(p));
      } else {
        headers = COLUMNS.map((c) => c.header);
        body = rows.map((r) => COLUMNS.map((c) => c.value(r)));
      }

      if (format === "xlsx") {
        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        wb.creator = BRAND.appName;
        wb.created = new Date();
        const ws = wb.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 4 }] });
        ws.addRow([`${BRAND.name} — ${title}`]).font = { bold: true, size: 14 };
        ws.addRow([`Period: ${rangeLabel} · ${rows.length} request${rows.length === 1 ? "" : "s"} · generated ${formatDateTime(new Date().toISOString())}`]).font = { italic: true, color: { argb: "FF5F6673" } };
        ws.addRow([]);
        const head = ws.addRow(headers);
        head.font = { bold: true, color: { argb: "FFFFFFFF" } };
        head.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } }));
        body.forEach((b) => ws.addRow(b));
        ws.columns.forEach((col, i) => {
          col.width = type === "admin_performance" ? 20 : COLUMNS[i]?.width ?? 16;
        });
        ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: headers.length } };
        if (type !== "admin_performance") ws.getColumn(10).numFmt = "#,##0";
        const buf = await wb.xlsx.writeBuffer();
        download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileBase}.xlsx`);
      } else {
        const doc = await newDocument(title, rangeLabel, "landscape");
        const table = await autoTable();
        doc.setFontSize(9);
        doc.setTextColor(95, 102, 115);
        doc.text(`${rows.length} request${rows.length === 1 ? "" : "s"}`, 36, 74);
        const pdfHeaders = type === "admin_performance" ? headers : headers.filter((h) => h !== "Department" && h !== "Decided on");
        const idx = pdfHeaders.map((h) => headers.indexOf(h));
        table(doc, {
          startY: 84,
          head: [pdfHeaders],
          body: body.map((b) =>
            idx.map((i) => (type !== "admin_performance" && headers[i] === "Est. expenses (INR)" && b[i] !== "" ? formatCurrency(b[i] as number) : String(b[i]))),
          ),
          headStyles: PDF_HEAD_STYLE,
          styles: { fontSize: 7.5, cellPadding: 3, overflow: "linebreak" },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          margin: { left: 24, right: 24 },
        });
        addFooter(doc);
        doc.save(`${fileBase}.pdf`);
      }
      setMsg({
        tone: truncated ? "warning" : "success",
        text: truncated ? "Downloaded the first 5,000 rows. Narrow the date range for the rest." : `Downloaded ${rows.length} record${rows.length === 1 ? "" : "s"}.`,
      });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader title="Generate a report" description="Reports include only the records you are allowed to see." />
      <CardBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((r) => (
            <label key={r.value} className={`cursor-pointer rounded-brand border p-3 ${type === r.value ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-muted"}`}>
              <input type="radio" name="report" value={r.value} checked={type === r.value} onChange={() => setType(r.value)} className="sr-only" />
              <span className="block text-sm font-medium text-ink">{r.label}</span>
              <span className="block text-xs text-muted">{r.description}</span>
            </label>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {type === "employee" && (
            <Field label="Employee" htmlFor="rep-employee" required>
              <Select id="rep-employee" value={employee} onChange={(e) => setEmployee(e.target.value)}>
                <option value="">Choose…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {type === "monthly" ? (
            <Field label="Month" htmlFor="rep-month" required>
              <Input id="rep-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>
          ) : (
            <>
              <Field label={type === "approvals" || type === "rejections" ? "Decided from" : "Departure from"} htmlFor="rep-from">
                <Input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To" htmlFor="rep-to">
                <Input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </>
          )}
        </div>

        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

        <div className="flex flex-col sm:flex-row gap-2.5">
          <Button onClick={() => run("xlsx")} loading={busy === "xlsx"} disabled={!!busy} className="w-full sm:w-auto justify-center">
            <FileSpreadsheet className="h-4 w-4" /> Download Excel
          </Button>
          <Button variant="secondary" onClick={() => run("pdf")} loading={busy === "pdf"} disabled={!!busy} className="w-full sm:w-auto justify-center">
            <FileText className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
