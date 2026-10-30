"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui";
import { addFooter, autoTable, newDocument, PDF_HEAD_STYLE } from "@/lib/pdf";
import type { ApprovalHistory, FlightDetails, SiteVisitDetails, TravelRequest } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime, formatTime, STATUS_LABEL, TRAVEL_TYPE_LABEL } from "@/lib/utils";

/** Generates the submitted travel form as a PDF in the browser. */
export function DownloadFormButton({
  request: r,
  flight,
  site,
  history,
  documentNames,
}: {
  request: TravelRequest;
  flight: FlightDetails | null;
  site: SiteVisitDetails | null;
  history: ApprovalHistory[];
  documentNames: string[];
}) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const doc = await newDocument("Travel Request Form", r.request_number ?? "Draft");
      const table = await autoTable();
      let y = 76;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`${r.request_number ?? "Draft"} — ${STATUS_LABEL[r.status]}`, 36, y);
      y += 10;

      const section = (title: string, rows: [string, string][]) => {
        table(doc, {
          startY: y + 8,
          head: [[title, ""]],
          body: rows.map(([k, v]) => [k, v || "—"]),
          theme: "grid",
          headStyles: PDF_HEAD_STYLE,
          styles: { fontSize: 9, cellPadding: 5, valign: "top" },
          columnStyles: { 0: { cellWidth: 170, fontStyle: "bold", textColor: [95, 102, 115] } },
          margin: { left: 36, right: 36 },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + 6;
      };

      section("A. Employee details", [
        ["Employee name", r.employee_name],
        ["Employee ID", r.employee_code],
        ["Department", r.employee_department ?? ""],
        ["Email", r.employee_email],
        ["Mobile number", r.mobile_number ?? ""],
        ["Reporting admin", r.assigned_admin_name ?? ""],
      ]);
      section("B & C. Travel details", [
        ["Travel type", TRAVEL_TYPE_LABEL[r.travel_type]],
        ["Departure city", r.departure_city],
        ["Destination", [r.destination_city, r.destination_state, r.destination_country].filter(Boolean).join(", ")],
        ["Purpose of travel", r.travel_purpose ?? ""],
        ["Departure", `${formatDate(r.departure_date)} ${formatTime(r.departure_time)}`],
        ["Expected return", `${formatDate(r.return_date)} ${formatTime(r.return_time)}`],
        ["Travel description", r.travel_description ?? ""],
        ["Additional remarks", r.additional_remarks ?? ""],
      ]);
      if (flight) {
        section("D. Flight details", [
          ["Airline", flight.airline_name ?? ""],
          ["Flight number", flight.flight_number ?? ""],
          ["From / to airport", [flight.departure_airport, flight.arrival_airport].filter(Boolean).join(" → ")],
          ["Departure", formatDateTime(flight.departure_datetime)],
          ["Return flight", [flight.return_flight_number, flight.return_datetime && formatDateTime(flight.return_datetime)].filter(Boolean).join(" · ")],
          ["Booking reference", flight.booking_reference ?? ""],
        ]);
      }
      if (site) {
        section("E. Site visit details", [
          ["Client / company", site.client_company_name ?? ""],
          ["Site address", site.site_address ?? ""],
          ["Site city", site.site_city ?? ""],
          ["Contact person", site.contact_person ?? ""],
          ["Contact number", site.contact_number ?? ""],
          ["Purpose of visit", site.visit_purpose ?? ""],
          ["Expected duration", site.expected_duration ?? ""],
          ["Notes", site.additional_notes ?? ""],
        ]);
      }
      section("F. Additional information", [
        ["Estimated expenses", formatCurrency(r.estimated_expenses)],
        ["Accommodation required", r.accommodation_required ? "Yes" : "No"],
        ["Transportation required", r.transportation_required ? "Yes" : "No"],
        ["Supporting documents", documentNames.join(", ")],
        ["Additional comments", r.additional_notes ?? ""],
      ]);
      section("Approval record", [
        ["Submitted", formatDateTime(r.submitted_at)],
        ["Status", STATUS_LABEL[r.status]],
        ...history.map(
          (h) =>
            [
              `${h.action === "approved" ? "Approved" : "Rejected"} by ${h.admin_name}`,
              `${formatDateTime(h.action_timestamp)}${h.comments ? ` — ${h.comments}` : ""}`,
            ] as [string, string],
        ),
      ]);

      addFooter(doc);
      doc.save(`${r.request_number ?? "travel-request-draft"}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="secondary" onClick={generate} loading={busy} className="w-full sm:w-auto justify-center">
      <Download className="h-4 w-4" /> Download form
    </Button>
  );
}
