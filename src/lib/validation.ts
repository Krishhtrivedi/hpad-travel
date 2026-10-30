import { z } from "zod";

const text = (max = 200) => z.string().trim().max(max, `Must be ${max} characters or fewer`);
const optionalText = (max = 200) => text(max).optional().or(z.literal(""));
const phone = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{7,20}$/, "Enter a valid phone number");

export const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 8;

export function validateFile(file: File): string | null {
  if (!ALLOWED_FILE_TYPES.includes(file.type as (typeof ALLOWED_FILE_TYPES)[number]))
    return `${file.name}: only PDF, JPG and PNG files are allowed`;
  if (file.size > MAX_FILE_BYTES) return `${file.name}: files must be 10 MB or smaller`;
  if (file.size === 0) return `${file.name}: the file is empty`;
  return null;
}

/** Shape shared by the form, the server action and the database RPC payload. */
export const travelRequestSchema = z.object({
  travel_type: z.enum(["flight", "site_visit", "other"]),
  mobile_number: z.string().trim().optional().or(z.literal("")),
  departure_city: optionalText(80),
  destination_city: optionalText(80),
  destination_state: optionalText(80),
  destination_country: optionalText(80),
  travel_purpose: optionalText(300),
  travel_description: optionalText(2000),
  departure_date: z.string().optional().or(z.literal("")),
  return_date: z.string().optional().or(z.literal("")),
  departure_time: z.string().optional().or(z.literal("")),
  return_time: z.string().optional().or(z.literal("")),
  estimated_expenses: z
    .string()
    .trim()
    .regex(/^\d{0,9}(\.\d{1,2})?$/, "Enter an amount in rupees")
    .optional()
    .or(z.literal("")),
  accommodation_required: z.boolean(),
  transportation_required: z.boolean(),
  additional_remarks: optionalText(2000),
  additional_notes: optionalText(2000),
  flight: z.object({
    airline_name: optionalText(80),
    flight_number: optionalText(20),
    departure_airport: optionalText(80),
    arrival_airport: optionalText(80),
    departure_date: z.string().optional().or(z.literal("")),
    departure_time: z.string().optional().or(z.literal("")),
    return_flight_number: optionalText(20),
    return_date: z.string().optional().or(z.literal("")),
    return_time: z.string().optional().or(z.literal("")),
    booking_reference: optionalText(40),
  }),
  site_visit: z.object({
    client_company_name: optionalText(150),
    site_address: optionalText(400),
    site_city: optionalText(80),
    contact_person: optionalText(100),
    contact_number: optionalText(20),
    visit_purpose: optionalText(400),
    expected_duration: optionalText(60),
    additional_notes: optionalText(2000),
  }),
});

export type TravelRequestInput = z.infer<typeof travelRequestSchema>;

/** Extra rules that apply only when submitting (drafts can be incomplete). */
export function submissionErrors(v: TravelRequestInput, today: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.mobile_number) e.mobile_number = "Mobile number is required";
  else if (!phone.safeParse(v.mobile_number).success) e.mobile_number = "Enter a valid phone number";
  if (!v.destination_city) e.destination_city = "Destination city is required";
  if (!v.destination_country) e.destination_country = "Destination country is required";
  if (!v.travel_purpose) e.travel_purpose = "Purpose of travel is required";
  if (!v.departure_date) e.departure_date = "Departure date is required";
  else if (v.departure_date < today) e.departure_date = "Departure date cannot be in the past";
  if (!v.return_date) e.return_date = "Expected return date is required";
  else if (v.departure_date && v.return_date < v.departure_date)
    e.return_date = "Return date must be on or after the departure date";
  if (
    v.departure_date &&
    v.departure_date === v.return_date &&
    v.departure_time &&
    v.return_time &&
    v.return_time <= v.departure_time
  )
    e.return_time = "Return time must be after departure time on a same-day trip";
  if (v.travel_type === "site_visit") {
    if (!v.site_visit.client_company_name) e["site_visit.client_company_name"] = "Client / company name is required";
    if (!v.site_visit.site_city) e["site_visit.site_city"] = "Site city is required";
    if (v.site_visit.contact_number && !phone.safeParse(v.site_visit.contact_number).success)
      e["site_visit.contact_number"] = "Enter a valid phone number";
  }
  if (v.travel_type === "flight" && v.flight.return_date && v.flight.departure_date && v.flight.return_date < v.flight.departure_date)
    e["flight.return_date"] = "Return flight cannot be before the outbound flight";
  return e;
}

/** Converts form values into the JSON payload the save_travel_request RPC expects. */
export function toRpcPayload(v: TravelRequestInput) {
  const ist = (d?: string, t?: string) => (d ? `${d}T${t || "00:00"}:00+05:30` : "");
  return {
    ...v,
    flight: {
      airline_name: v.flight.airline_name,
      flight_number: v.flight.flight_number,
      departure_airport: v.flight.departure_airport,
      arrival_airport: v.flight.arrival_airport,
      departure_datetime: ist(v.flight.departure_date, v.flight.departure_time),
      return_flight_number: v.flight.return_flight_number,
      return_datetime: ist(v.flight.return_date, v.flight.return_time),
      booking_reference: v.flight.booking_reference,
    },
  };
}

export const decisionSchema = z
  .object({
    requestId: z.uuid(),
    decision: z.enum(["approve", "reject"]),
    comments: z.string().trim().max(2000, "Comments must be 2000 characters or fewer").optional(),
  })
  .refine((v) => v.decision === "approve" || (v.comments && v.comments.length > 0), {
    message: "A rejection reason is required",
    path: ["comments"],
  });

export const userSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter the full name").max(120),
    email: z.email("Enter a valid email").trim().toLowerCase(),
    employee_id: z
      .string()
      .trim()
      .min(1, "Employee ID is required")
      .max(30)
      .regex(/^[A-Za-z0-9\-_/]+$/, "Use letters, numbers, - _ or /"),
    phone: phone.optional().or(z.literal("")),
    department: z.string().trim().max(80).optional().or(z.literal("")),
    role: z.enum(["admin", "employee"]),
    assigned_admin_id: z.string().optional().or(z.literal("")),
    password: z.string().optional().or(z.literal("")),
  })
  .refine((v) => v.role !== "employee" || !!v.assigned_admin_id, {
    message: "Every employee must report to an Admin",
    path: ["assigned_admin_id"],
  });

export const passwordSchema = z
  .string()
  .min(6, "Use at least 6 characters")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[0-9]/, "Include a number");
