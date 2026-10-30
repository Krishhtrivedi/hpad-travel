import { adminClient, fail } from "./_admin-client";

const DOMAIN = "hpad.com";
const PASSWORD = process.env.DEMO_PASSWORD ?? "HpadDemo@2026";

async function main() {
  const supabase = adminClient();

  console.log("Fetching existing profiles...");
  const { data: profs, error } = await supabase
    .from("profiles")
    .select("id, auth_user_id, employee_id, full_name, email, role")
    .order("created_at");

  if (error || !profs) fail("Failed to fetch profiles", error?.message);

  const saProfile = profs.find((p) => p.role === "super_admin");
  const adminProfiles = profs.filter((p) => p.role === "admin");
  const empProfiles = profs.filter((p) => p.role === "employee");

  // 1. Update Super Admin -> KARAN
  if (saProfile) {
    console.log("Updating Super Admin to Karan...");
    const email = `karan@${DOMAIN}`;
    if (saProfile.auth_user_id) {
      await supabase.auth.admin.updateUserById(saProfile.auth_user_id, {
        email,
        password: PASSWORD,
        user_metadata: { full_name: "Karan" },
      });
    }
    await supabase.from("profiles").update({
      full_name: "Karan",
      email,
    }).eq("id", saProfile.id);
  }

  // 2. Update Admin 1 -> Arjun
  const primaryAdmin = adminProfiles[0];
  if (primaryAdmin) {
    console.log("Updating Admin to Arjun...");
    const email = `arjun@${DOMAIN}`;
    if (primaryAdmin.auth_user_id) {
      await supabase.auth.admin.updateUserById(primaryAdmin.auth_user_id, {
        email,
        password: PASSWORD,
        user_metadata: { full_name: "Arjun" },
      });
    }
    await supabase.from("profiles").update({
      full_name: "Arjun",
      email,
    }).eq("id", primaryAdmin.id);

    // Update all travel requests assigned admin name
    await supabase.from("travel_requests").update({
      assigned_admin_id: primaryAdmin.id,
      assigned_admin_name: "Arjun",
    }).eq("is_demo", true);
  }

  // If there was a second admin, deactivate or keep inactive
  if (adminProfiles.length > 1) {
    for (const extraAdmin of adminProfiles.slice(1)) {
      await supabase.from("profiles").update({ is_active: false }).eq("id", extraAdmin.id);
    }
  }

  // 3. Update 10 Employees
  const employeeNames = [
    "Aarav",
    "Saii",
    "Pooja",
    "Gagan",
    "Rupesh",
    "Meet",
    "Vidhi",
    "Mahek",
    "Dinkle",
    "Pari",
  ];

  for (let i = 0; i < employeeNames.length && i < empProfiles.length; i++) {
    const ep = empProfiles[i];
    const name = employeeNames[i];
    const email = `${name.toLowerCase()}@${DOMAIN}`;

    console.log(`Updating ${ep.full_name} -> ${name} (${email})...`);

    if (ep.auth_user_id) {
      await supabase.auth.admin.updateUserById(ep.auth_user_id, {
        email,
        password: PASSWORD,
        user_metadata: { full_name: name },
      });
    }

    await supabase.from("profiles").update({
      full_name: name,
      email,
      assigned_admin_id: primaryAdmin?.id,
    }).eq("id", ep.id);

    // Update their travel requests
    await supabase.from("travel_requests").update({
      employee_name: name,
      employee_email: email,
    }).eq("employee_id", ep.id);
  }

  console.log("\n✓ All team members updated successfully!");
  console.log(`Password for all accounts: ${PASSWORD}\n`);
  console.log(`Super Admin: karan@${DOMAIN}`);
  console.log(`Admin:       arjun@${DOMAIN}`);
  employeeNames.forEach((name) => console.log(`Employee:    ${name.toLowerCase()}@${DOMAIN}`));
}

main().catch(console.error);
