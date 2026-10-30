"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { friendlyError, todayIST } from "@/lib/utils";
import {
  ALLOWED_FILE_TYPES,
  decisionSchema,
  MAX_FILE_BYTES,
  submissionErrors,
  toRpcPayload,
  travelRequestSchema,
} from "@/lib/validation";

type SaveResult = { id: string; request_number: string | null; status: string; duplicate?: boolean };

/** Save a draft or submit a travel request (employee only). */
export async function saveTravelRequest(input: {
  values: unknown;
  submit: boolean;
  requestId?: string | null;
  clientToken: string;
}): Promise<ActionResult<SaveResult>> {
  try {
    await assertRole(["employee"]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const parsed = travelRequestSchema.safeParse(input.values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
    return { ok: false, error: "Please correct the highlighted fields.", fieldErrors };
  }
  if (input.submit) {
    const fieldErrors = submissionErrors(parsed.data, todayIST());
    if (Object.keys(fieldErrors).length) return { ok: false, error: "Please complete the required fields.", fieldErrors };
  }
  const token = z.uuid().safeParse(input.clientToken);
  const id = input.requestId ? z.uuid().safeParse(input.requestId) : null;
  if (!token.success || (id && !id.success)) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_travel_request", {
    p_request_id: id?.success ? id.data : null,
    p_payload: toRpcPayload(parsed.data),
    p_submit: input.submit,
    p_client_token: token.data,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath("/employee", "layout");
  return { ok: true, data: data as SaveResult };
}

/** Approve or reject — the database function enforces assignment, locking and single decision. */
export async function decideRequest(input: {
  requestId: string;
  decision: "approve" | "reject";
  comments?: string;
}): Promise<ActionResult<{ status: string }>> {
  try {
    await assertRole(["admin", "super_admin"]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_travel_request", {
    p_request_id: parsed.data.requestId,
    p_decision: parsed.data.decision,
    p_comments: parsed.data.comments ?? null,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath("/admin", "layout");
  revalidatePath("/super-admin", "layout");
  return { ok: true, data: { status: (data as { status: string }).status } };
}

const docSchema = z.object({
  storage_path: z.string().min(10).max(400),
  file_name: z.string().min(1).max(200),
  file_type: z.enum(ALLOWED_FILE_TYPES),
  file_size: z.number().int().positive().max(MAX_FILE_BYTES),
  document_kind: z.enum(["flight_ticket", "supporting"]),
});

/** Record files that the browser has uploaded to the private bucket. */
export async function registerDocuments(requestId: string, docs: unknown[]): Promise<ActionResult> {
  let me;
  try {
    me = await assertRole(["employee"]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const rid = z.uuid().safeParse(requestId);
  const parsed = z.array(docSchema).max(10).safeParse(docs);
  if (!rid.success || !parsed.success) return { ok: false, error: "Invalid document details." };
  if (parsed.data.some((d) => !d.storage_path.startsWith(`${rid.data}/`))) return { ok: false, error: "Invalid document path." };
  if (parsed.data.length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.from("documents").insert(
    parsed.data.map((d) => ({ ...d, travel_request_id: rid.data, uploaded_by: me.id })),
  );
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(`/employee/requests/${rid.data}`);
  return { ok: true };
}

/** Short-lived signed URL for a document the user is allowed to see. */
export async function getDocumentUrl(documentId: string): Promise<ActionResult<{ url: string }>> {
  const id = z.uuid().safeParse(documentId);
  if (!id.success) return { ok: false, error: "Invalid document." };
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path, file_name").eq("id", id.data).maybeSingle();
  if (!doc) return { ok: false, error: "Document not found or access denied." };
  const { data, error } = await supabase.storage.from("travel-documents").createSignedUrl(doc.storage_path, 300, {
    download: false,
  });
  if (error || !data) return { ok: false, error: "Could not open the document." };
  return { ok: true, data: { url: data.signedUrl } };
}

export async function deleteDraft(requestId: string): Promise<ActionResult> {
  try {
    await assertRole(["employee"]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const id = z.uuid().safeParse(requestId);
  if (!id.success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();

  const { data: docs } = await supabase.from("documents").select("storage_path").eq("travel_request_id", id.data);
  if (docs?.length) await supabase.storage.from("travel-documents").remove(docs.map((d) => d.storage_path));

  const { error } = await supabase.rpc("delete_draft", { p_request_id: id.data });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/employee", "layout");
  return { ok: true };
}
