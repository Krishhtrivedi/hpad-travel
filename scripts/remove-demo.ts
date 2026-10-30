/**
 * Removes ONLY demo data (rows with is_demo = true, their files and logins).
 * Real data and the audit trail are untouched.
 *
 *   npm run demo:remove
 */
import { adminClient, fail } from "./_admin-client";

async function main() {
  const supabase = adminClient();
  const { data, error } = await supabase.rpc("purge_demo_data");
  if (error) fail("purge_demo_data failed", error.message);
  const result = data as { requests_deleted: number; auth_user_ids: string[]; storage_paths: string[] };

  if (result.storage_paths.length) {
    const { error: sErr } = await supabase.storage.from("travel-documents").remove(result.storage_paths);
    if (sErr) console.warn("Some demo files could not be removed:", sErr.message);
  }
  for (const id of result.auth_user_ids) {
    const { error: aErr } = await supabase.auth.admin.deleteUser(id);
    if (aErr) console.warn(`Could not delete login ${id}:`, aErr.message);
  }
  console.log(`✓ Removed ${result.requests_deleted} demo requests, ${result.auth_user_ids.length} demo logins and ${result.storage_paths.length} files.`);
}

main();
