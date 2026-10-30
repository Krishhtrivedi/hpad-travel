"use client";

import { createClient } from "@/lib/supabase/client";
import { validateFile } from "@/lib/validation";

export interface PendingFile {
  file: File;
  kind: "flight_ticket" | "supporting";
}

/**
 * Uploads files straight from the browser into the private bucket under
 * <requestId>/…  Storage RLS only allows this for the request's owner while
 * it is a draft or pending.
 */
export async function uploadDocuments(requestId: string, files: PendingFile[]) {
  const supabase = createClient();
  const uploaded: {
    storage_path: string;
    file_name: string;
    file_type: string;
    file_size: number;
    document_kind: "flight_ticket" | "supporting";
  }[] = [];

  for (const { file, kind } of files) {
    const problem = validateFile(file);
    if (problem) throw new Error(problem);
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
    const path = `${requestId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("travel-documents").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(`${file.name}: ${error.message}`);
    uploaded.push({ storage_path: path, file_name: file.name.slice(0, 200), file_type: file.type, file_size: file.size, document_kind: kind });
  }
  return uploaded;
}
