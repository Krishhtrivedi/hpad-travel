"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { Building2, CheckCircle2, FileUp, MapPin, Paperclip, Plane, Trash2, X } from "lucide-react";
import { deleteDraft, registerDocuments, saveTravelRequest } from "@/app/actions/requests";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, ReadOnlyField, Select, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { BRAND } from "@/lib/brand";
import { uploadDocuments, type PendingFile } from "@/lib/upload";
import type { DocumentRow } from "@/lib/types";
import { cn, formatBytes, todayIST } from "@/lib/utils";
import { EMPTY_VALUES } from "./values";
import { MAX_FILES, submissionErrors, travelRequestSchema, validateFile, type TravelRequestInput } from "@/lib/validation";

export interface FormEmployee {
  name: string;
  employeeId: string;
  department: string | null;
  email: string;
  phone: string | null;
  adminName: string | null;
}

const TYPES = [
  { value: "flight", label: "Flight Travel", hint: "Air travel for official work", icon: Plane },
  { value: "site_visit", label: `Site Visit Outside ${BRAND.homeCity}`, hint: "Client or project site", icon: Building2 },
  { value: "other", label: "Other Official Travel", hint: "Meetings, training, events", icon: MapPin },
] as const;

export function TravelRequestForm({
  employee,
  initialValues,
  requestId: initialId,
  existingDocuments = [],
}: {
  employee: FormEmployee;
  initialValues?: TravelRequestInput;
  requestId?: string;
  existingDocuments?: DocumentRow[];
}) {
  const router = useRouter();
  const clientToken = useRef(crypto.randomUUID());
  const [requestId, setRequestId] = useState<string | undefined>(initialId);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: string; number: string } | null>(null);

  const {
    register,
    control,
    getValues,
    setError,
    clearErrors,
    setValue,
    formState: { errors, isDirty },
  } = useForm<TravelRequestInput>({
    defaultValues: initialValues ?? { ...EMPTY_VALUES, mobile_number: employee.phone ?? "" },
  });

  const travelType = useWatch({ control, name: "travel_type" });
  const departureDate = useWatch({ control, name: "departure_date" });
  const accommodation = useWatch({ control, name: "accommodation_required" });
  const transportation = useWatch({ control, name: "transportation_required" });
  const today = useMemo(() => todayIST(), []);

  const err = (name: string) => {
    const parts = name.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let e: any = errors;
    for (const p of parts) e = e?.[p];
    return e?.message as string | undefined;
  };

  const applyErrors = (fieldErrors: Record<string, string>) => {
    for (const [k, v] of Object.entries(fieldErrors)) setError(k as Path<TravelRequestInput>, { message: v });
    const first = Object.keys(fieldErrors)[0];
    if (first) document.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  };

  const addFiles = (list: FileList | null, kind: PendingFile["kind"]) => {
    setFileError(null);
    const incoming = Array.from(list ?? []);
    const problem = incoming.map(validateFile).find(Boolean);
    if (problem) return setFileError(problem);
    if (files.length + existingDocuments.length + incoming.length > MAX_FILES)
      return setFileError(`You can attach up to ${MAX_FILES} files.`);
    setFiles((f) => [...f, ...incoming.map((file) => ({ file, kind }))]);
  };

  /** Validate on the client, save, upload files, and (optionally) submit. */
  const save = async (submit: boolean) => {
    setFormError(null);
    setNotice(null);
    clearErrors();
    const values = getValues();
    const parsed = travelRequestSchema.safeParse(values);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[i.path.join(".")] = i.message;
      applyErrors(fe);
      setFormError("Please correct the highlighted fields.");
      return;
    }
    if (submit) {
      const fe = submissionErrors(parsed.data, todayIST());
      if (Object.keys(fe).length) {
        applyErrors(fe);
        setFormError("Please complete the required fields before submitting.");
        return;
      }
    }

    setBusy(submit ? "submit" : "draft");
    try {
      // 1. Save as draft to get (or keep) an ID for the documents.
      const draft = await saveTravelRequest({ values: parsed.data, submit: false, requestId, clientToken: clientToken.current });
      if (!draft.ok) {
        if (draft.fieldErrors) applyErrors(draft.fieldErrors);
        throw new Error(draft.error);
      }
      const id = draft.data!.id;
      setRequestId(id);

      // 2. Upload any new files.
      if (files.length) {
        const docs = await uploadDocuments(id, files);
        const reg = await registerDocuments(id, docs);
        if (!reg.ok) throw new Error(reg.error);
        setFiles([]);
      }

      if (!submit) {
        setNotice("Draft saved. You can come back and finish it later from My Requests.");
        if (!initialId) router.replace(`/employee/requests/${id}/edit`);
        else router.refresh();
        return;
      }

      // 3. Submit.
      const res = await saveTravelRequest({ values: parsed.data, submit: true, requestId: id, clientToken: clientToken.current });
      if (!res.ok) {
        if (res.fieldErrors) applyErrors(res.fieldErrors);
        throw new Error(res.error);
      }
      setSubmitted({ id, number: res.data!.request_number! });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(null);
      setConfirmOpen(false);
    }
  };

  const discard = async () => {
    if (!requestId) {
      router.push("/employee");
      return;
    }
    if (!confirm("Delete this draft and any files attached to it?")) return;
    setBusy("draft");
    const res = await deleteDraft(requestId);
    setBusy(null);
    if (!res.ok) return setFormError(res.error);
    router.push("/employee/requests");
  };

  if (submitted) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardBody className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <h2 className="mt-4 text-xl font-semibold">Travel request submitted</h2>
          <p className="mt-2 text-muted">
            Your request ID is <span className="font-semibold text-ink">{submitted.number}</span>. It has been sent to{" "}
            {employee.adminName ?? "your reporting admin"} for approval, and you&apos;ll be notified when they decide.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => router.push(`/employee/requests/${submitted.id}`)}>View request</Button>
            <Button variant="secondary" onClick={() => router.push("/employee")}>
              Back to dashboard
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  const text = (name: Path<TravelRequestInput>, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Input id={name} {...register(name)} aria-invalid={!!err(name)} {...props} />
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setConfirmOpen(true);
      }}
      className="space-y-6"
      noValidate
    >
      {formError && <Alert tone="danger">{formError}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {/* A. Employee details */}
      <Card>
        <CardHeader title="A. Employee details" description="Filled in from your profile." />
        <CardBody>
          <dl className="grid gap-4 sm:grid-cols-3">
            <ReadOnlyField label="Employee name" value={employee.name} />
            <ReadOnlyField label="Employee ID" value={employee.employeeId} />
            <ReadOnlyField label="Department" value={employee.department} />
            <ReadOnlyField label="Email address" value={employee.email} />
            <ReadOnlyField label="Reporting admin" value={employee.adminName ?? "Not assigned — contact the Super Admin"} />
            <Field label="Mobile number" htmlFor="mobile_number" required error={err("mobile_number")}>
              {text("mobile_number", { type: "tel", autoComplete: "tel", placeholder: "+91 98765 43210" })}
            </Field>
          </dl>
        </CardBody>
      </Card>

      {/* B. Travel type */}
      <Card>
        <CardHeader title="B. Travel type" />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Travel type">
            {TYPES.map((t) => {
              const Icon = t.icon;
              const active = travelType === t.value;
              return (
                <label
                  key={t.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-brand border p-4 transition-colors",
                    active ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-muted",
                  )}
                >
                  <input type="radio" value={t.value} {...register("travel_type")} className="sr-only" />
                  <Icon className={cn("mt-0.5 h-5 w-5", active ? "text-brand" : "text-muted")} />
                  <span>
                    <span className="block text-sm font-medium text-ink">{t.label}</span>
                    <span className="block text-xs text-muted">{t.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* C. Travel details */}
      <Card>
        <CardHeader title="C. Travel details" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Departure city" htmlFor="departure_city" error={err("departure_city")}>
            {text("departure_city")}
          </Field>
          <Field label="Destination city" htmlFor="destination_city" required error={err("destination_city")}>
            {text("destination_city", { placeholder: "e.g. Mumbai" })}
          </Field>
          <Field label="Destination state" htmlFor="destination_state" error={err("destination_state")}>
            {text("destination_state", { placeholder: "e.g. Maharashtra" })}
          </Field>
          <Field label="Destination country" htmlFor="destination_country" required error={err("destination_country")}>
            {text("destination_country")}
          </Field>
          <Field label="Purpose of travel" htmlFor="travel_purpose" required error={err("travel_purpose")} className="sm:col-span-2">
            {text("travel_purpose", { placeholder: "e.g. Design review with client" })}
          </Field>
          <Field label="Departure date" htmlFor="departure_date" required error={err("departure_date")}>
            {text("departure_date", { type: "date", min: today })}
          </Field>
          <Field label="Departure time" htmlFor="departure_time" error={err("departure_time")}>
            {text("departure_time", { type: "time" })}
          </Field>
          <div className="hidden lg:block" />
          <Field label="Expected return date" htmlFor="return_date" required error={err("return_date")}>
            {text("return_date", { type: "date", min: departureDate || today })}
          </Field>
          <Field label="Expected return time" htmlFor="return_time" error={err("return_time")}>
            {text("return_time", { type: "time" })}
          </Field>
          <div className="hidden lg:block" />
          <Field label="Travel description" htmlFor="travel_description" error={err("travel_description")} className="sm:col-span-2 lg:col-span-3">
            <Textarea id="travel_description" {...register("travel_description")} placeholder="Itinerary, people you are meeting, deliverables…" />
          </Field>
          <Field label="Additional remarks" htmlFor="additional_remarks" error={err("additional_remarks")} className="sm:col-span-2 lg:col-span-3">
            <Textarea id="additional_remarks" {...register("additional_remarks")} className="min-h-[64px]" />
          </Field>
        </CardBody>
      </Card>

      {/* D. Flight details */}
      {travelType === "flight" && (
        <Card>
          <CardHeader title="D. Flight details" description="Optional if tickets are not booked yet — you can add them later." />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Airline name" htmlFor="flight.airline_name" error={err("flight.airline_name")}>
              {text("flight.airline_name")}
            </Field>
            <Field label="Flight number" htmlFor="flight.flight_number" error={err("flight.flight_number")}>
              {text("flight.flight_number", { placeholder: "e.g. 6E 123" })}
            </Field>
            <Field label="Ticket booking reference" htmlFor="flight.booking_reference" error={err("flight.booking_reference")}>
              {text("flight.booking_reference", { placeholder: "PNR" })}
            </Field>
            <Field label="Departure airport" htmlFor="flight.departure_airport" error={err("flight.departure_airport")}>
              {text("flight.departure_airport", { placeholder: "e.g. AMD" })}
            </Field>
            <Field label="Arrival airport" htmlFor="flight.arrival_airport" error={err("flight.arrival_airport")}>
              {text("flight.arrival_airport", { placeholder: "e.g. BOM" })}
            </Field>
            <div className="hidden lg:block" />
            <Field label="Flight departure date" htmlFor="flight.departure_date" error={err("flight.departure_date")}>
              {text("flight.departure_date", { type: "date" })}
            </Field>
            <Field label="Flight departure time" htmlFor="flight.departure_time" error={err("flight.departure_time")}>
              {text("flight.departure_time", { type: "time" })}
            </Field>
            <div className="hidden lg:block" />
            <Field label="Return flight number" htmlFor="flight.return_flight_number" error={err("flight.return_flight_number")}>
              {text("flight.return_flight_number")}
            </Field>
            <Field label="Return flight date" htmlFor="flight.return_date" error={err("flight.return_date")}>
              {text("flight.return_date", { type: "date" })}
            </Field>
            <Field label="Return flight time" htmlFor="flight.return_time" error={err("flight.return_time")}>
              {text("flight.return_time", { type: "time" })}
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <FilePicker label="Upload flight ticket" onPick={(l) => addFiles(l, "flight_ticket")} />
            </div>
          </CardBody>
        </Card>
      )}

      {/* E. Site visit details */}
      {travelType === "site_visit" && (
        <Card>
          <CardHeader title="E. Site visit details" />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Client / company name" htmlFor="site_visit.client_company_name" required error={err("site_visit.client_company_name")}>
              {text("site_visit.client_company_name")}
            </Field>
            <Field label="Site city" htmlFor="site_visit.site_city" required error={err("site_visit.site_city")}>
              {text("site_visit.site_city")}
            </Field>
            <Field label="Expected visit duration" htmlFor="site_visit.expected_duration" error={err("site_visit.expected_duration")}>
              {text("site_visit.expected_duration", { placeholder: "e.g. 2 days" })}
            </Field>
            <Field label="Site address" htmlFor="site_visit.site_address" error={err("site_visit.site_address")} className="sm:col-span-2 lg:col-span-3">
              <Textarea id="site_visit.site_address" {...register("site_visit.site_address")} className="min-h-[64px]" />
            </Field>
            <Field label="Contact person" htmlFor="site_visit.contact_person" error={err("site_visit.contact_person")}>
              {text("site_visit.contact_person")}
            </Field>
            <Field label="Contact number" htmlFor="site_visit.contact_number" error={err("site_visit.contact_number")}>
              {text("site_visit.contact_number", { type: "tel" })}
            </Field>
            <div className="hidden lg:block" />
            <Field label="Purpose of visit" htmlFor="site_visit.visit_purpose" error={err("site_visit.visit_purpose")} className="sm:col-span-2 lg:col-span-3">
              <Textarea id="site_visit.visit_purpose" {...register("site_visit.visit_purpose")} className="min-h-[64px]" />
            </Field>
            <Field label="Additional notes" htmlFor="site_visit.additional_notes" error={err("site_visit.additional_notes")} className="sm:col-span-2 lg:col-span-3">
              <Textarea id="site_visit.additional_notes" {...register("site_visit.additional_notes")} className="min-h-[64px]" />
            </Field>
          </CardBody>
        </Card>
      )}

      {/* F. Additional information */}
      <Card>
        <CardHeader title="F. Additional information" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Estimated travel expenses (₹)" htmlFor="estimated_expenses" error={err("estimated_expenses")}>
            {text("estimated_expenses", { inputMode: "decimal", placeholder: "0" })}
          </Field>
          <Field label="Accommodation required" htmlFor="accommodation_required">
            <YesNo
              id="accommodation_required"
              value={accommodation}
              onChange={(v) => setValue("accommodation_required", v, { shouldDirty: true })}
            />
          </Field>
          <Field label="Transportation required" htmlFor="transportation_required">
            <YesNo
              id="transportation_required"
              value={transportation}
              onChange={(v) => setValue("transportation_required", v, { shouldDirty: true })}
            />
          </Field>
          <div className="sm:col-span-3">
            <FilePicker label="Supporting documents" onPick={(l) => addFiles(l, "supporting")} />
          </div>
          <Field label="Additional comments" htmlFor="additional_notes" error={err("additional_notes")} className="sm:col-span-3">
            <Textarea id="additional_notes" {...register("additional_notes")} className="min-h-[64px]" />
          </Field>

          {(files.length > 0 || existingDocuments.length > 0 || fileError) && (
            <div className="space-y-2 sm:col-span-3">
              {fileError && <p className="text-sm text-danger">{fileError}</p>}
              <ul className="divide-y divide-line rounded-brand border border-line">
                {existingDocuments.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Paperclip className="h-4 w-4 text-muted" />
                    <span className="flex-1 truncate">{d.file_name}</span>
                    <span className="text-xs text-muted">Saved · {formatBytes(d.file_size)}</span>
                  </li>
                ))}
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Paperclip className="h-4 w-4 text-muted" />
                    <span className="flex-1 truncate">{f.file.name}</span>
                    <span className="text-xs text-muted">
                      {f.kind === "flight_ticket" ? "Ticket" : "Supporting"} · {formatBytes(f.file.size)}
                    </span>
                    <button type="button" onClick={() => setFiles((all) => all.filter((_, j) => j !== i))} className="rounded p-1 text-muted hover:text-danger" aria-label={`Remove ${f.file.name}`}>
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Buttons */}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-brand sm:border pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {requestId ? (
          <Button type="button" variant="ghost" className="mr-auto text-danger" onClick={discard} disabled={!!busy}>
            <Trash2 className="h-4 w-4" /> Delete draft
          </Button>
        ) : (
          <Link href="/employee" className="mr-auto px-3 text-sm font-medium text-muted hover:text-ink">
            Cancel
          </Link>
        )}
        <Button type="button" variant="secondary" onClick={() => save(false)} loading={busy === "draft"} disabled={!!busy || (!isDirty && !files.length && !!requestId)}>
          Save draft
        </Button>
        <Button type="submit" loading={busy === "submit"} disabled={!!busy || !employee.adminName}>
          <FileUp className="h-4 w-4" /> Submit travel request
        </Button>
      </div>

      <Dialog open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} title="Submit this travel request?" description={`It will be sent to ${employee.adminName ?? "your reporting admin"} for approval. You won't be able to edit it after submitting.`}>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={!!busy}>
            Keep editing
          </Button>
          <Button onClick={() => save(true)} loading={busy === "submit"}>
            Submit request
          </Button>
        </div>
      </Dialog>
    </form>
  );
}

function YesNo({ id, value, onChange }: { id: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Select id={id} value={value ? "yes" : "no"} onChange={(e) => onChange(e.target.value === "yes")}>
      <option value="no">No</option>
      <option value="yes">Yes</option>
    </Select>
  );
}

function FilePicker({ label, onPick }: { label: string; onPick: (files: FileList | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">{label}</p>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex w-full flex-col items-center justify-center rounded-brand border border-dashed border-line bg-surface-muted px-4 py-5 text-sm text-muted hover:border-brand hover:text-brand"
      >
        <FileUp className="mb-1 h-5 w-5" />
        Choose files · PDF, JPG or PNG up to 10 MB
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        hidden
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
