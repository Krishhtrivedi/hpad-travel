import { PageHeader } from "@/components/ui";
import { ReportBuilder } from "@/features/reports/report-builder";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Reports" };

export default async function Page() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, employee_id").eq("role", "employee").order("full_name");
  const employees = (data ?? []).map((e) => ({ id: e.id, label: `${e.full_name} (${e.employee_id})` }));
  return (
    <>
      <PageHeader title="Reports" description="Export travel data to Excel or PDF." />
      <ReportBuilder employees={employees} />
    </>
  );
}
