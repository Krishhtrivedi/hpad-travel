"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { friendlyError } from "@/lib/utils";
import { passwordSchema } from "@/lib/validation";

/** Users may change only their own phone number (enforced again by a DB trigger). */
export async function updateMyPhone(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const me = await getCurrentProfile();
  if (!me) return { ok: false, error: "Please sign in again." };
  const phone = String(formData.get("phone") ?? "").trim();
  if (phone && !/^[0-9+()\-\s]{7,20}$/.test(phone)) return { ok: false, error: "Enter a valid phone number." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ phone: phone || null }).eq("id", me.id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Phone number updated." };
}

export async function changeMyPassword(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const me = await getCurrentProfile();
  if (!me) return { ok: false, error: "Please sign in again." };
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (password !== confirm) return { ok: false, error: "The new passwords do not match." };

  const supabase = await createClient();
  // Re-check the current password before allowing the change.
  const { error: reauth } = await supabase.auth.signInWithPassword({ email: me.email, password: current });
  if (reauth) return { ok: false, error: "Your current password is incorrect." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "Password changed." };
}
