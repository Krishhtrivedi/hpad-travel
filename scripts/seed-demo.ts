/**
 * Demo / development data: 1 Super Admin, 2 Admins, 10 Employees and a
 * realistic spread of requests (pending, approved, rejected, flight, site
 * visit, past history, current and upcoming travel).
 *
 * Every row is flagged is_demo = true and every login uses @demo.hpad.local,
 * so it never mixes with real data. Remove it all with `npm run demo:remove`.
 * Recommended: run this only against a separate development Supabase project.
 *
 *   SEED_DEMO=yes npm run demo:seed
 */
import { adminClient, fail } from "./_admin-client";

const DOMAIN = "hpad.com";
const PASSWORD = process.env.DEMO_PASSWORD ?? "HpadDemo@2026";

const ADMINS = [
  { name: "Arjun", id: "DEMO-ADM-01", dept: "Projects" },
];
const EMPLOYEES = [
  { name: "Aarav", dept: "Architecture", admin: 0 },
  { name: "Saii", dept: "Interiors", admin: 0 },
  { name: "Pooja", dept: "Design", admin: 0 },
  { name: "Gagan", dept: "Site Supervision", admin: 0 },
  { name: "Rupesh", dept: "Structural", admin: 0 },
  { name: "Meet", dept: "Architecture", admin: 0 },
  { name: "Vidhi", dept: "Landscape", admin: 0 },
  { name: "Mahek", dept: "Interiors", admin: 0 },
  { name: "Dinkle", dept: "MEP", admin: 0 },
  { name: "Pari", dept: "Project Management", admin: 0 },
];

const DESTS = [
  { city: "Mumbai", state: "Maharashtra", airport: "BOM" },
  { city: "Bengaluru", state: "Karnataka", airport: "BLR" },
  { city: "New Delhi", state: "Delhi", airport: "DEL" },
  { city: "Pune", state: "Maharashtra", airport: "PNQ" },
  { city: "Surat", state: "Gujarat", airport: "STV" },
  { city: "Vadodara", state: "Gujarat", airport: "BDQ" },
  { city: "Jaipur", state: "Rajasthan", airport: "JAI" },
  { city: "Hyderabad", state: "Telangana", airport: "HYD" },
  { city: "Rajkot", state: "Gujarat", airport: "RAJ" },
];
const AIRLINES = ["IndiGo", "Air India", "Akasa Air", "SpiceJet"];
const CLIENTS = ["Shivalik Developers", "Adani Realty site office", "Sun Builders", "GIFT City project team", "Narmada Hospital Trust", "Riverfront Housing"];
const PURPOSES = {
  flight: ["Client design presentation", "Project kick-off meeting", "Consultant coordination meeting", "Material vendor visit", "Design review with client"],
  site_visit: ["Site inspection and progress review", "Structural audit", "Snag list walkthrough", "Survey and measurements", "Handover inspection"],
  other: ["Industry conference", "Training workshop", "Municipal approval follow-up", "Vendor factory visit"],
};
const REJECTIONS = [
  "Meeting can be held over video call this time.",
  "Dates clash with the submission deadline — please reschedule.",
  "Budget for this quarter is exhausted; resubmit next month.",
  "Please combine with the visit planned later this month.",
];

// Deterministic pseudo-random so every seed looks the same
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

function istDate(offsetDays: number) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}
const ts = (date: string, time = "10:00") => `${date}T${time}:00+05:30`;

async function main() {
  if (process.env.SEED_DEMO !== "yes") fail("Refusing to run. Set SEED_DEMO=yes to confirm you want demo data in this project.");
  const supabase = adminClient();

  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_demo", true);
  if (count) fail("Demo data already exists. Run `npm run demo:remove` first.");

  const createLogin = async (email: string, name: string) => {
    const { data, error } = await supabase.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name } });
    if (error || !data.user) fail(`Could not create login ${email}`, error?.message);
    return data.user.id;
  };
  const slug = (n: string) => n.toLowerCase().replace(/[^a-z]+/g, ".");

  console.log("Creating people…");
  const saAuth = await createLogin(`karan@${DOMAIN}`, "Karan");
  const { data: sa, error: saErr } = await supabase
    .from("profiles")
    .insert({ auth_user_id: saAuth, employee_id: "DEMO-SA-01", full_name: "Karan", email: `karan@${DOMAIN}`, department: "Management", role: "super_admin", is_demo: true })
    .select()
    .single();
  if (saErr) fail("Super admin profile", saErr.message);

  const admins: { id: string; full_name: string }[] = [];
  for (const a of ADMINS) {
    const email = `${slug(a.name)}@${DOMAIN}`;
    const authId = await createLogin(email, a.name);
    const { data, error } = await supabase
      .from("profiles")
      .insert({ auth_user_id: authId, employee_id: a.id, full_name: a.name, email, phone: "+91 98250 1" + String(admins.length).padStart(4, "0"), department: a.dept, role: "admin", is_demo: true })
      .select("id, full_name")
      .single();
    if (error) fail(`Admin ${a.name}`, error.message);
    admins.push(data);
  }

  const employees: { id: string; full_name: string; employee_id: string; department: string; email: string; phone: string; admin: { id: string; full_name: string } }[] = [];
  for (const [i, e] of EMPLOYEES.entries()) {
    const email = `${slug(e.name)}@${DOMAIN}`;
    const authId = await createLogin(email, e.name);
    const phone = `+91 9${String(8000000000 + i * 1234567).slice(0, 9)}`;
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        auth_user_id: authId,
        employee_id: `DEMO-EMP-${String(i + 1).padStart(2, "0")}`,
        full_name: e.name,
        email,
        phone,
        department: e.dept,
        role: "employee",
        assigned_admin_id: admins[e.admin].id,
        is_demo: true,
      })
      .select("id, full_name, employee_id, department, email")
      .single();
    if (error) fail(`Employee ${e.name}`, error.message);
    employees.push({ ...data, phone, admin: admins[e.admin] });
  }

  // ---- Requests ---------------------------------------------------------
  type Plan = { emp: number; depart: number; days: number; status: "pending" | "approved" | "rejected" | "draft"; type: "flight" | "site_visit" | "other" };
  const plans: Plan[] = [];
  // Past history: last ~10 months, mostly approved
  for (let i = 0; i < 26; i++) {
    plans.push({ emp: i % 10, depart: -300 + Math.floor(rand() * 290), days: 1 + Math.floor(rand() * 3), status: rand() < 0.78 ? "approved" : "rejected", type: pick(["flight", "flight", "site_visit", "site_visit", "other"] as const) });
  }
  // Currently on approved travel
  plans.push({ emp: 2, depart: -1, days: 3, status: "approved", type: "site_visit" });
  plans.push({ emp: 5, depart: 0, days: 2, status: "approved", type: "flight" });
  // Upcoming approved
  plans.push({ emp: 0, depart: 4, days: 2, status: "approved", type: "flight" });
  plans.push({ emp: 7, depart: 9, days: 1, status: "approved", type: "site_visit" });
  plans.push({ emp: 3, depart: 15, days: 3, status: "approved", type: "other" });
  // Pending
  plans.push({ emp: 1, depart: 6, days: 2, status: "pending", type: "flight" });
  plans.push({ emp: 4, depart: 8, days: 1, status: "pending", type: "site_visit" });
  plans.push({ emp: 6, depart: 12, days: 4, status: "pending", type: "flight" });
  plans.push({ emp: 9, depart: 20, days: 2, status: "pending", type: "other" });
  plans.push({ emp: 8, depart: 3, days: 1, status: "pending", type: "site_visit" });
  // Recent rejection and a draft
  plans.push({ emp: 1, depart: 10, days: 2, status: "rejected", type: "flight" });
  plans.push({ emp: 0, depart: 25, days: 2, status: "draft", type: "flight" });

  console.log(`Creating ${plans.length} travel requests…`);
  // Oldest first so request numbers follow submission order
  plans.sort((a, b) => a.depart - b.depart);

  for (const p of plans) {
    const e = employees[p.emp];
    const dest = pick(DESTS);
    const departure = istDate(p.depart);
    const ret = istDate(p.depart + p.days - 1);
    const submittedOffset = p.depart - (3 + Math.floor(rand() * 10));
    const submittedAt = ts(istDate(submittedOffset), `${String(9 + Math.floor(rand() * 8)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}`);
    const reviewedAt = new Date(new Date(submittedAt).getTime() + (2 + rand() * 40) * 3600000).toISOString();
    const purpose = pick(PURPOSES[p.type]);

    let requestNumber: string | null = null;
    if (p.status !== "draft") {
      const { data, error } = await supabase.rpc("next_request_number");
      if (error) fail("next_request_number", error.message);
      requestNumber = data as string;
    }
    const decided = p.status === "approved" || p.status === "rejected";
    const comments = p.status === "rejected" ? pick(REJECTIONS) : decided && rand() < 0.4 ? "Approved. Please share the trip report afterwards." : null;

    const { data: req, error } = await supabase
      .from("travel_requests")
      .insert({
        request_number: requestNumber,
        employee_id: e.id,
        assigned_admin_id: e.admin.id,
        employee_name: e.full_name,
        employee_code: e.employee_id,
        employee_department: e.department,
        employee_email: e.email,
        assigned_admin_name: e.admin.full_name,
        travel_type: p.type,
        mobile_number: e.phone,
        departure_city: "Ahmedabad",
        destination_city: dest.city,
        destination_state: dest.state,
        destination_country: "India",
        travel_purpose: purpose,
        travel_description: `${purpose} in ${dest.city}.`,
        departure_date: departure,
        return_date: ret,
        departure_time: "07:30",
        return_time: "20:00",
        estimated_expenses: Math.round((p.type === "flight" ? 14000 : 4000) + rand() * 12000),
        accommodation_required: p.days > 1,
        transportation_required: rand() < 0.6,
        status: p.status,
        submitted_at: p.status === "draft" ? null : submittedAt,
        reviewed_at: decided ? reviewedAt : null,
        reviewed_by: decided ? e.admin.id : null,
        reviewed_by_name: decided ? e.admin.full_name : null,
        review_comments: comments,
        is_demo: true,
      })
      .select("id")
      .single();
    if (error) fail(`Request for ${e.full_name}`, error.message);

    if (p.type === "flight") {
      const booked = p.status !== "pending" || rand() < 0.5;
      const airline = pick(AIRLINES);
      await supabase.from("flight_details").insert({
        travel_request_id: req.id,
        airline_name: booked ? airline : null,
        flight_number: booked ? `${airline === "IndiGo" ? "6E" : airline === "Air India" ? "AI" : airline === "Akasa Air" ? "QP" : "SG"} ${100 + Math.floor(rand() * 899)}` : null,
        departure_airport: "AMD",
        arrival_airport: dest.airport,
        departure_datetime: booked ? ts(departure, "07:30") : null,
        return_flight_number: booked ? `${100 + Math.floor(rand() * 899)}` : null,
        return_datetime: booked ? ts(ret, "20:00") : null,
        booking_reference: booked ? Math.random().toString(36).slice(2, 8).toUpperCase() : null,
      });
    } else if (p.type === "site_visit") {
      await supabase.from("site_visit_details").insert({
        travel_request_id: req.id,
        client_company_name: pick(CLIENTS),
        site_address: `Plot ${10 + Math.floor(rand() * 200)}, Ring Road, ${dest.city}`,
        site_city: dest.city,
        contact_person: pick(["Mr. Sharma", "Ms. Nair", "Mr. Kulkarni", "Ms. Reddy"]),
        contact_number: "+91 99090 12345",
        visit_purpose: purpose,
        expected_duration: `${p.days} day${p.days > 1 ? "s" : ""}`,
      });
    }

    if (decided) {
      await supabase.from("approval_history").insert({
        travel_request_id: req.id,
        admin_id: e.admin.id,
        admin_name: e.admin.full_name,
        previous_status: "pending",
        new_status: p.status,
        action: p.status,
        comments,
        action_timestamp: reviewedAt,
      });
    }
    if (p.status === "pending") {
      await supabase.from("notifications").insert({
        recipient_user_id: e.admin.id,
        travel_request_id: req.id,
        notification_type: "new_request",
        title: "New travel request",
        message: `${e.full_name} submitted ${requestNumber} — ${dest.city}.`,
      });
    }
    if (decided && p.depart > -30) {
      await supabase.from("notifications").insert({
        recipient_user_id: e.id,
        travel_request_id: req.id,
        notification_type: p.status === "approved" ? "request_approved" : "request_rejected",
        title: p.status === "approved" ? "Request approved" : "Request rejected",
        message: `${requestNumber} to ${dest.city} was ${p.status} by ${e.admin.full_name}.`,
      });
    }
  }

  console.log(`\n✓ Demo data created. Password for every demo login: ${PASSWORD}\n`);
  console.log(`  Super Admin   karan@${DOMAIN}`);
  admins.forEach((a, i) => console.log(`  Admin         ${slug(ADMINS[i].name)}@${DOMAIN}`));
  employees.forEach((e) => console.log(`  Employee      ${e.email}  (reports to ${e.admin.full_name})`));
  void sa;
}

main();
