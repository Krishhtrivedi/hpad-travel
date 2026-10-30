/**
 * Creates the first real Super Admin (production bootstrap).
 *
 *   SUPER_ADMIN_EMAIL=you@hpad.co.in SUPER_ADMIN_NAME="Full Name" \
 *   SUPER_ADMIN_EMPLOYEE_ID=HPAD-001 SUPER_ADMIN_PASSWORD='…' \
 *   npm run create-super-admin
 *
 * After this, sign in and create Admins and Employees from the app.
 */
import { adminClient, fail } from "./_admin-client";

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.SUPER_ADMIN_NAME?.trim();
  const employeeId = process.env.SUPER_ADMIN_EMPLOYEE_ID?.trim();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !name || !employeeId || !password) {
    fail("Set SUPER_ADMIN_EMAIL, SUPER_ADMIN_NAME, SUPER_ADMIN_EMPLOYEE_ID and SUPER_ADMIN_PASSWORD.");
  }
  if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    fail("Password must be 10+ characters with upper and lower case letters and a number.");
  }

  const supabase = adminClient();
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error || !data.user) fail("Could not create the login.", error?.message);

  const { error: pErr } = await supabase.from("profiles").insert({
    auth_user_id: data.user.id,
    employee_id: employeeId,
    full_name: name,
    email,
    role: "super_admin",
  });
  if (pErr) {
    await supabase.auth.admin.deleteUser(data.user.id);
    fail("Could not create the profile (login rolled back).", pErr.message);
  }
  console.log(`✓ Super Admin created: ${name} <${email}>`);
}

main();
