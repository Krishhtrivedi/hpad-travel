import { Alert, PageHeader } from "@/components/ui";
import { TravelRequestForm } from "@/features/travel-form/travel-request-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "New Travel Request" };

export default async function Page() {
  const profile = await requireRole(["employee"]);
  const supabase = await createClient();
  const { data: admin } = profile.assigned_admin_id
    ? await supabase.from("profiles").select("full_name, is_active").eq("id", profile.assigned_admin_id).maybeSingle()
    : { data: null };
  const adminName = admin?.is_active ? admin.full_name : null;

  return (
    <>
      <PageHeader title="New travel request" description="Flight travel, site visits and other official travel outside Ahmedabad." />
      {!adminName && (
        <Alert tone="warning" className="mb-6">
          You don&apos;t have an active reporting admin, so requests can&apos;t be submitted yet. You can still save a draft. Please contact the Super Admin.
        </Alert>
      )}
      <TravelRequestForm
        employee={{
          name: profile.full_name,
          employeeId: profile.employee_id,
          department: profile.department,
          email: profile.email,
          phone: profile.phone,
          adminName,
        }}
      />
    </>
  );
}
