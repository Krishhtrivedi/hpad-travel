"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";
import { homeFor } from "@/lib/utils";
import { passwordSchema } from "@/lib/validation";
import type { ActionResult, Role } from "@/lib/types";

const loginSchema = z.object({
  email: z.string().min(1, "Enter your email address or employee ID").trim(),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

export async function signIn(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  let emailToUse = parsed.data.email.toLowerCase();

  const supabase = await createClient();

  // If the user entered an Employee ID / User ID (e.g. HPAD-001 or karan) instead of a full email
  if (!emailToUse.includes("@")) {
    try {
      const { data: matched } = await supabase
        .from("profiles")
        .select("email")
        .ilike("employee_id", parsed.data.email)
        .maybeSingle();

      if (matched?.email) {
        emailToUse = matched.email;
      } else {
        emailToUse = `${parsed.data.email.toLowerCase()}@hpad.com`;
      }
    } catch {
      // If profile query fails, try falling back to company email format
      emailToUse = `${parsed.data.email.toLowerCase()}@hpad.com`;
    }
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      const msg = error?.message?.toLowerCase() ?? "";
      if (
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("enotfound") ||
        msg.includes("connection") ||
        error?.status === 503 ||
        error?.status === 502
      ) {
        return {
          ok: false,
          error: "Database is paused or temporarily unreachable. Please restore your Supabase project from the Supabase dashboard.",
        };
      }
      return {
        ok: false,
        error: error?.status === 429 ? "Too many attempts. Please wait a few minutes." : "Incorrect email or password.",
      };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      await supabase.auth.signOut();
      return { ok: false, error: "Your account is not active. Please contact the Super Admin." };
    }

    const home = homeFor(profile.role as Role);
    const next = parsed.data.next;
    // Only follow `next` if it is a local path inside this user's own area.
    redirect(next && next.startsWith(home) && !next.startsWith("//") ? next : home);
  } catch (err: unknown) {
    // If Next.js redirect threw, rethrow it so navigation proceeds
    if (err && typeof err === "object" && "digest" in err) {
      throw err;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("fetch failed") || errMsg.includes("ENOTFOUND")) {
      return {
        ok: false,
        error: "Database is paused on Supabase. Please open your Supabase dashboard and click 'Restore project'.",
      };
    }
    return {
      ok: false,
      error: "Unable to connect to authentication service. Please check Supabase project status.",
    };
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { ok: false, error: "Enter a valid email address." };

  const origin = (await headers()).get("origin") ?? SITE_URL;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  // Same response whether or not the account exists, so emails can't be probed.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (password !== confirm) return { ok: false, error: "The passwords do not match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "Your password has been updated." };
}
