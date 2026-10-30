import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TravelRequestForm } from "@/features/travel-form/travel-request-form";
import { requestToFormValues } from "@/features/travel-form/values";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRow, FlightDetails, SiteVisitDetails, TravelRequest } from "@/lib/types";

export const metadata = { title: "Edit Draft" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["employee"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("travel_requests").select("*").eq("id", id).eq("employee_id", profile.id).maybeSingle();
  if (!data) notFound();
  const r = data as TravelRequest;
  // Submitted requests are read-only.
  if (r.status !== "draft") redirect(`/employee/requests/${id}`);

  const [{ data: flight }, { data: site }, { data: docs }, { data: admin }] = await Promise.all([
    supabase.from("flight_details").select("*").eq("travel_request_id", id).maybeSingle(),
    supabase.from("site_visit_details").select("*").eq("travel_request_id", id).maybeSingle(),
    supabase.from("documents").select("*").eq("travel_request_id", id),
    profile.assigned_admin_id
      ? supabase.from("profiles").select("full_name, is_active").eq("id", profile.assigned_admin_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <PageHeader title="Continue draft" description="Finish the details and submit when you're ready." />
      <TravelRequestForm
        requestId={id}
        initialValues={requestToFormValues(r, flight as FlightDetails | null, site as SiteVisitDetails | null)}
        existingDocuments={(docs as DocumentRow[]) ?? []}
        employee={{
          name: profile.full_name,
          employeeId: profile.employee_id,
          department: profile.department,
          email: profile.email,
          phone: profile.phone,
          adminName: admin?.is_active ? admin.full_name : null,
        }}
      />
    </>
  );
}
