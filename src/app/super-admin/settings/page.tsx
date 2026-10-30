import { Alert, Card, CardBody, CardHeader, PageHeader, ReadOnlyField } from "@/components/ui";
import { ProfileView } from "@/features/profile/profile-view";
import { requireRole } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { ReminderButton } from "./reminder-button";

export const metadata = { title: "Settings" };

export default async function Page() {
  const profile = await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { count: pendingOver24h } = await supabase
    .from("travel_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("submitted_at", new Date(Date.now() - 86400000).toISOString());

  return (
    <>
      <PageHeader title="Settings" description="System configuration and your own account." />
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Approval reminders" description="Notify admins about requests pending for more than 24 hours." />
          <CardBody className="space-y-4">
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">{pendingOver24h ?? 0}</span> request{pendingOver24h === 1 ? " is" : "s are"} waiting more than 24 hours.
              Each admin is reminded at most once a day per request.
            </p>
            <ReminderButton />
            <p className="text-xs text-muted">To send reminders automatically every morning, schedule <code>select public.send_pending_reminders();</code> with Supabase Cron (see README).</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Branding" />
          <CardBody className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Application name" value={BRAND.fullTitle} />
              <ReadOnlyField label="Home city" value={BRAND.homeCity} />
              <ReadOnlyField label="Time zone" value={BRAND.timeZone} />
              <ReadOnlyField label="Official logo" value={BRAND.logoLightSrc ? "Official white logo installed" : "Not yet supplied"} />
            </dl>
            <Alert tone="info">
              Brand colours and font are still placeholders until the existing HPAD design is shared. A developer can update them in{" "}
              <code>src/app/globals.css</code>.
            </Alert>
          </CardBody>
        </Card>
      </div>
      <ProfileView profile={profile} title="My account" />
    </>
  );
}
