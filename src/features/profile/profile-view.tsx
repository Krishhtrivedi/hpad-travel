import { Card, CardBody, CardHeader, PageHeader, ReadOnlyField } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { formatDate, ROLE_LABEL } from "@/lib/utils";
import { PasswordForm, PhoneForm } from "./profile-forms";

export async function ProfileView({ profile, title = "My profile" }: { profile: Profile; title?: string }) {
  let adminName: string | null = null;
  if (profile.assigned_admin_id) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("full_name").eq("id", profile.assigned_admin_id).maybeSingle();
    adminName = data?.full_name ?? null;
  }
  return (
    <>
      <PageHeader title={title} description="Your details are managed by the Super Admin. You can update your phone number and password." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Account details" />
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Full name" value={profile.full_name} />
              <ReadOnlyField label="Employee ID" value={profile.employee_id} />
              <ReadOnlyField label="Email" value={profile.email} />
              <ReadOnlyField label="Department" value={profile.department} />
              <ReadOnlyField label="Role" value={ROLE_LABEL[profile.role]} />
              {profile.role === "employee" && <ReadOnlyField label="Reporting admin" value={adminName} />}
              <ReadOnlyField label="Member since" value={formatDate(profile.created_at)} />
            </dl>
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Phone number" />
            <CardBody>
              <PhoneForm phone={profile.phone ?? ""} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Change password" />
            <CardBody>
              <PasswordForm />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
