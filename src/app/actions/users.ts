"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { friendlyError } from "@/lib/utils";
import { passwordSchema, userSchema } from "@/lib/validation";

function fieldErrorsFrom(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[i.path.join(".")] = i.message;
  return out;
}

function refresh() {
  revalidatePath("/super-admin", "layout");
}

/**
 * Creates a login (Supabase Auth, via the server-only secret key) and the
 * matching profile (inserted as the Super Admin so RLS and the audit trail
 * record who did it). Rolls back the login if the profile fails.
 */
export async function createUser(input: unknown): Promise<ActionResult> {
  try {
    await assertRole(["super_admin"]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const v = parsed.data;

  const pw = passwordSchema.safeParse(v.password ?? "");
  if (!pw.success) return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: { password: pw.error.issues[0].message } };

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: v.email,
    password: pw.data,
    email_confirm: true,
    user_metadata: { full_name: v.full_name },
  });
  if (authError || !created.user) {
    const msg = authError?.message ?? "Could not create the login.";
    return { ok: false, error: /already|registered|exists/i.test(msg) ? "A login with this email already exists." : msg };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").insert({
    auth_user_id: created.user.id,
    employee_id: v.employee_id,
    full_name: v.full_name,
    email: v.email,
    phone: v.phone || null,
    department: v.department || null,
    role: v.role,
    assigned_admin_id: v.role === "employee" ? v.assigned_admin_id : null,
  });
  if (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: friendlyError(error.message) };
  }
  refresh();
  return { ok: true, message: `${v.full_name} can now sign in with ${v.email}.` };
}

export async function updateUser(profileId: string, input: unknown): Promise<ActionResult> {
  try {
    await assertRole(["super_admin"]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const id = z.uuid().safeParse(profileId);
  const parsed = userSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid user." };
  if (!parsed.success) return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("auth_user_id, email, role").eq("id", id.data).single();
  if (!current) return { ok: false, error: "User not found." };

  if (current.email !== v.email && current.auth_user_id) {
    const { error } = await createAdminClient().auth.admin.updateUserById(current.auth_user_id, { email: v.email, email_confirm: true });
    if (error) return { ok: false, error: error.message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      employee_id: v.employee_id,
      full_name: v.full_name,
      email: v.email,
      phone: v.phone || null,
      department: v.department || null,
      assigned_admin_id: current.role === "employee" ? v.assigned_admin_id : null,
    })
    .eq("id", id.data);
  if (error) return { ok: false, error: friendlyError(error.message) };
  refresh();
  return { ok: true, message: "Changes saved." };
}

export async function reassignEmployee(profileId: string, adminId: string): Promise<ActionResult> {
  try {
    await assertRole(["super_admin"]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const ids = z.tuple([z.uuid(), z.uuid()]).safeParse([profileId, adminId]);
  if (!ids.success) return { ok: false, error: "Invalid selection." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ assigned_admin_id: adminId }).eq("id", profileId).eq("role", "employee");
  if (error) return { ok: false, error: friendlyError(error.message) };
  refresh();
  return { ok: true, message: "Employee reassigned. Their pending requests moved to the new admin." };
}

/** Deactivation is enforced twice: the profile (RLS denies all data) and the login (banned). */
export async function setUserActive(profileId: string, active: boolean): Promise<ActionResult> {
  let me;
  try {
    me = await assertRole(["super_admin"]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const id = z.uuid().safeParse(profileId);
  if (!id.success) return { ok: false, error: "Invalid user." };
  if (id.data === me.id) return { ok: false, error: "You cannot deactivate your own account." };

  const supabase = await createClient();
  const { data: target, error } = await supabase.from("profiles").update({ is_active: active }).eq("id", id.data).select("auth_user_id, full_name").single();
  if (error) return { ok: false, error: friendlyError(error.message) };

  if (target?.auth_user_id) {
    const { error: banError } = await createAdminClient().auth.admin.updateUserById(target.auth_user_id, {
      ban_duration: active ? "none" : "876000h",
    });
    if (banError) return { ok: false, error: `Profile updated, but the login could not be ${active ? "unblocked" : "blocked"}: ${banError.message}` };
  }
  refresh();
  return { ok: true, message: `${target?.full_name} has been ${active ? "activated" : "deactivated"}.` };
}

/** Sends the standard secure reset email — the Super Admin never sees or sets the new password. */
export async function sendPasswordReset(profileId: string): Promise<ActionResult> {
  try {
    await assertRole(["super_admin"]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const id = z.uuid().safeParse(profileId);
  if (!id.success) return { ok: false, error: "Invalid user." };
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("email, full_name").eq("id", id.data).single();
  if (!target) return { ok: false, error: "User not found." };
  const origin = (await headers()).get("origin") ?? SITE_URL;
  const { error } = await supabase.auth.resetPasswordForEmail(target.email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  if (error) return { ok: false, error: error.message };
  await supabase.rpc("log_admin_action", {
    p_action: "password_reset_sent",
    p_entity_type: "profile",
    p_entity_id: id.data,
    p_data: { email: target.email },
  });
  return { ok: true, message: `A password reset link was emailed to ${target.email}.` };
}

export async function sendPendingReminders(): Promise<ActionResult<{ count: number }>> {
  try {
    await assertRole(["super_admin"]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_pending_reminders");
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { count: data as number }, message: `Sent ${data} reminder${data === 1 ? "" : "s"}.` };
}
