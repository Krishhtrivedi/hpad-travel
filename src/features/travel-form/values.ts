import { BRAND } from "@/lib/brand";
import type { FlightDetails, SiteVisitDetails, TravelRequest } from "@/lib/types";
import type { TravelRequestInput } from "@/lib/validation";

export const EMPTY_VALUES: TravelRequestInput = {
  travel_type: "flight",
  mobile_number: "",
  departure_city: BRAND.homeCity,
  destination_city: "",
  destination_state: "",
  destination_country: "India",
  travel_purpose: "",
  travel_description: "",
  departure_date: "",
  return_date: "",
  departure_time: "",
  return_time: "",
  estimated_expenses: "",
  accommodation_required: false,
  transportation_required: false,
  additional_remarks: "",
  additional_notes: "",
  flight: {
    airline_name: "",
    flight_number: "",
    departure_airport: "",
    arrival_airport: "",
    departure_date: "",
    departure_time: "",
    return_flight_number: "",
    return_date: "",
    return_time: "",
    booking_reference: "",
  },
  site_visit: {
    client_company_name: "",
    site_address: "",
    site_city: "",
    contact_person: "",
    contact_number: "",
    visit_purpose: "",
    expected_duration: "",
    additional_notes: "",
  },
};

/** Splits a timestamptz into IST date + time strings for the form. */
function istParts(value: string | null): [string, string] {
  if (!value) return ["", ""];
  const d = new Date(value);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: BRAND.timeZone }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: BRAND.timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return [date, time];
}

/** Turns a saved draft back into form values. */
export function requestToFormValues(r: TravelRequest, f: FlightDetails | null, s: SiteVisitDetails | null): TravelRequestInput {
  const [fdDate, fdTime] = istParts(f?.departure_datetime ?? null);
  const [frDate, frTime] = istParts(f?.return_datetime ?? null);
  return {
    travel_type: r.travel_type,
    mobile_number: r.mobile_number ?? "",
    departure_city: r.departure_city ?? BRAND.homeCity,
    destination_city: r.destination_city ?? "",
    destination_state: r.destination_state ?? "",
    destination_country: r.destination_country ?? "India",
    travel_purpose: r.travel_purpose ?? "",
    travel_description: r.travel_description ?? "",
    departure_date: r.departure_date ?? "",
    return_date: r.return_date ?? "",
    departure_time: r.departure_time?.slice(0, 5) ?? "",
    return_time: r.return_time?.slice(0, 5) ?? "",
    estimated_expenses: r.estimated_expenses != null ? String(r.estimated_expenses) : "",
    accommodation_required: r.accommodation_required,
    transportation_required: r.transportation_required,
    additional_remarks: r.additional_remarks ?? "",
    additional_notes: r.additional_notes ?? "",
    flight: {
      airline_name: f?.airline_name ?? "",
      flight_number: f?.flight_number ?? "",
      departure_airport: f?.departure_airport ?? "",
      arrival_airport: f?.arrival_airport ?? "",
      departure_date: fdDate,
      departure_time: fdTime,
      return_flight_number: f?.return_flight_number ?? "",
      return_date: frDate,
      return_time: frTime,
      booking_reference: f?.booking_reference ?? "",
    },
    site_visit: {
      client_company_name: s?.client_company_name ?? "",
      site_address: s?.site_address ?? "",
      site_city: s?.site_city ?? "",
      contact_person: s?.contact_person ?? "",
      contact_number: s?.contact_number ?? "",
      visit_purpose: s?.visit_purpose ?? "",
      expected_duration: s?.expected_duration ?? "",
      additional_notes: s?.additional_notes ?? "",
    },
  };
}
