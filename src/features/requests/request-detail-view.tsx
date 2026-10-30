import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Plane, XCircle } from "lucide-react";
import { Alert, Badge, Card, CardBody, CardHeader, ReadOnlyField, StatusBadge } from "@/components/ui";
import { AddDocuments } from "@/components/requests/add-documents";
import { DecisionPanel } from "@/components/requests/decision-panel";
import { DocumentList } from "@/components/requests/document-list";
import { DownloadFormButton } from "@/components/requests/download-form-button";
import { createClient } from "@/lib/supabase/server";
import type { ApprovalHistory, DocumentRow, FlightDetails, Profile, SiteVisitDetails, TravelRequest } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime, formatTime, homeFor, todayIST, TRAVEL_TYPE_LABEL } from "@/lib/utils";

export async function RequestDetailView({ profile, id, backHref }: { profile: Profile; id: string; backHref: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  // RLS decides visibility: anything not returned here is not this user's to see.
  const { data: request } = await supabase.from("travel_requests").select("*").eq("id", id).maybeSingle();
  if (!request) notFound();
  const r = request as TravelRequest;

  const [{ data: flight }, { data: site }, { data: history }, { data: documents }] = await Promise.all([
    supabase.from("flight_details").select("*").eq("travel_request_id", id).maybeSingle(),
    supabase.from("site_visit_details").select("*").eq("travel_request_id", id).maybeSingle(),
    supabase.from("approval_history").select("*").eq("travel_request_id", id).order("action_timestamp"),
    supabase.from("documents").select("*").eq("travel_request_id", id).order("uploaded_at"),
  ]);

  const f = flight as FlightDetails | null;
  const s = site as SiteVisitDetails | null;
  const h = (history as ApprovalHistory[]) ?? [];
  const docs = (documents as DocumentRow[]) ?? [];

  const canDecide =
    r.status === "pending" &&
    r.employee_id !== profile.id &&
    (profile.role === "super_admin" || (profile.role === "admin" && r.assigned_admin_id === profile.id));
  const isOwner = r.employee_id === profile.id;
  const today = todayIST();
  const travelling = r.status === "approved" && r.departure_date && r.return_date && r.departure_date <= today && r.return_date >= today;
  const upcoming = r.status === "approved" && r.departure_date && r.departure_date > today;

  return (
    <div className="space-y-6">
      <Link href={backHref} className="no-print inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{r.request_number}</h1>
            <StatusBadge status={r.status} />
            <Badge>{TRAVEL_TYPE_LABEL[r.travel_type]}</Badge>
            {travelling && <Badge className="bg-info-soft text-info">On approved travel now</Badge>}
            {upcoming && <Badge className="bg-brand-soft text-brand">Upcoming travel</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {r.employee_name} · {r.departure_city} → {r.destination_city} · {formatDate(r.departure_date)} – {formatDate(r.return_date)}
          </p>
        </div>
        <DownloadFormButton request={r} flight={f} site={s} history={h} documentNames={docs.map((d) => d.file_name)} />
      </div>

      {r.status === "approved" && (
        <p className="text-xs text-muted">Approval authorises the trip. It is not a record that travel actually took place.</p>
      )}

      {canDecide && <DecisionPanel requestId={r.id} requestNumber={r.request_number ?? ""} employeeName={r.employee_name} />}
      {r.status === "pending" && profile.role === "admin" && r.assigned_admin_id !== profile.id && (
        <Alert tone="info">This request is assigned to {r.assigned_admin_name}. Only they can decide on it.</Alert>
      )}
      {r.status === "rejected" && r.review_comments && (
        <Alert tone="danger" title={`Rejected by ${r.reviewed_by_name} on ${formatDateTime(r.reviewed_at)}`}>
          {r.review_comments}
        </Alert>
      )}
      {r.status === "approved" && (
        <Alert tone="success" title={`Approved by ${r.reviewed_by_name} on ${formatDateTime(r.reviewed_at)}`}>
          {r.review_comments}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Employee details" />
            <CardBody>
              <dl className="grid gap-4 sm:grid-cols-3">
                <ReadOnlyField label="Name" value={r.employee_name} />
                <ReadOnlyField label="Employee ID" value={r.employee_code} />
                <ReadOnlyField label="Department" value={r.employee_department} />
                <ReadOnlyField label="Email" value={r.employee_email} />
                <ReadOnlyField label="Mobile" value={r.mobile_number} />
                <ReadOnlyField label="Reporting admin" value={r.assigned_admin_name} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Travel details" />
            <CardBody>
              <dl className="grid gap-4 sm:grid-cols-3">
                <ReadOnlyField label="Departure city" value={r.departure_city} />
                <ReadOnlyField label="Destination" value={[r.destination_city, r.destination_state].filter(Boolean).join(", ")} />
                <ReadOnlyField label="Country" value={r.destination_country} />
                <ReadOnlyField label="Departure" value={`${formatDate(r.departure_date)} ${formatTime(r.departure_time)}`} />
                <ReadOnlyField label="Expected return" value={`${formatDate(r.return_date)} ${formatTime(r.return_time)}`} />
                <ReadOnlyField label="Estimated expenses" value={formatCurrency(r.estimated_expenses)} />
                <div className="sm:col-span-3">
                  <ReadOnlyField label="Purpose of travel" value={r.travel_purpose} />
                </div>
                {r.travel_description && (
                  <div className="sm:col-span-3">
                    <ReadOnlyField label="Description" value={<span className="whitespace-pre-line">{r.travel_description}</span>} />
                  </div>
                )}
                {r.additional_remarks && (
                  <div className="sm:col-span-3">
                    <ReadOnlyField label="Additional remarks" value={<span className="whitespace-pre-line">{r.additional_remarks}</span>} />
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>

          {f && (
            <Card>
              <CardHeader title={<span className="inline-flex items-center gap-2"><Plane className="h-4 w-4" /> Flight details</span>} />
              <CardBody>
                {!f.flight_number && !f.airline_name && <p className="mb-4 text-sm text-muted">Tickets not booked yet.</p>}
                <dl className="grid gap-4 sm:grid-cols-3">
                  <ReadOnlyField label="Airline" value={f.airline_name} />
                  <ReadOnlyField label="Flight number" value={f.flight_number} />
                  <ReadOnlyField label="Booking reference" value={f.booking_reference} />
                  <ReadOnlyField label="From airport" value={f.departure_airport} />
                  <ReadOnlyField label="To airport" value={f.arrival_airport} />
                  <ReadOnlyField label="Departure" value={formatDateTime(f.departure_datetime)} />
                  <ReadOnlyField label="Return flight" value={f.return_flight_number} />
                  <ReadOnlyField label="Return flight time" value={formatDateTime(f.return_datetime)} />
                </dl>
              </CardBody>
            </Card>
          )}

          {s && (
            <Card>
              <CardHeader title="Site visit details" />
              <CardBody>
                <dl className="grid gap-4 sm:grid-cols-3">
                  <ReadOnlyField label="Client / company" value={s.client_company_name} />
                  <ReadOnlyField label="Site city" value={s.site_city} />
                  <ReadOnlyField label="Expected duration" value={s.expected_duration} />
                  <div className="sm:col-span-3">
                    <ReadOnlyField label="Site address" value={s.site_address} />
                  </div>
                  <ReadOnlyField label="Contact person" value={s.contact_person} />
                  <ReadOnlyField label="Contact number" value={s.contact_number} />
                  <div className="sm:col-span-3">
                    <ReadOnlyField label="Purpose of visit" value={s.visit_purpose} />
                  </div>
                  {s.additional_notes && (
                    <div className="sm:col-span-3">
                      <ReadOnlyField label="Notes" value={s.additional_notes} />
                    </div>
                  )}
                </dl>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Additional information" />
            <CardBody>
              <dl className="grid gap-4 sm:grid-cols-3">
                <ReadOnlyField label="Accommodation required" value={r.accommodation_required ? "Yes" : "No"} />
                <ReadOnlyField label="Transportation required" value={r.transportation_required ? "Yes" : "No"} />
                <div className="sm:col-span-3">
                  <ReadOnlyField label="Additional comments" value={r.additional_notes} />
                </div>
              </dl>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Documents" />
            <CardBody className="space-y-3">
              <DocumentList documents={docs} />
              {isOwner && r.status === "pending" && <AddDocuments requestId={r.id} isFlight={r.travel_type === "flight"} />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Approval history" />
            <CardBody>
              <ol className="space-y-4">
                <TimelineItem icon={<Clock className="h-4 w-4" />} tone="text-muted" title="Submitted" when={r.submitted_at}>
                  Sent to {r.assigned_admin_name}
                </TimelineItem>
                {h.map((item) => (
                  <TimelineItem
                    key={item.id}
                    icon={item.action === "approved" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    tone={item.action === "approved" ? "text-success" : "text-danger"}
                    title={`${item.action === "approved" ? "Approved" : "Rejected"} by ${item.admin_name}`}
                    when={item.action_timestamp}
                  >
                    {item.comments}
                  </TimelineItem>
                ))}
                {r.status === "pending" && (
                  <TimelineItem icon={<Clock className="h-4 w-4" />} tone="text-warning" title="Awaiting decision" when={null} />
                )}
              </ol>
            </CardBody>
          </Card>

          {profile.role !== "employee" && (
            <Link href={`${homeFor(profile.role)}/history?employee=${r.employee_id}`} className="no-print block text-sm font-medium text-brand hover:underline">
              View {r.employee_name}&apos;s full travel history →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  icon,
  tone,
  title,
  when,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  when: string | null;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        {when && <p className="text-xs text-muted">{formatDateTime(when)}</p>}
        {children && <p className="mt-1 whitespace-pre-line text-sm text-muted">{children}</p>}
      </div>
    </li>
  );
}
