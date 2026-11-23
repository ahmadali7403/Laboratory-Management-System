import { apiContext } from "@/lib/scope";
import { RestoreError, restoreBackups } from "@/lib/backup";
import { fail, handleError, json, readJson } from "@/lib/http";

const MAX_BYTES = 25 * 1024 * 1024;

/** POST /api/restore?mode=merge|overwrite   body: the backup JSON file */
export async function POST(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_BYTES) return fail("Backup file is too large (max 25 MB). Restore module by module.", 413);
    const mode = new URL(request.url).searchParams.get("mode") || "merge";

    const file = await readJson(request);
    if (file === null) return fail("The file is not valid JSON.", 400);
    const summary = await restoreBackups(file, auth.ctx.actor, mode);
    return json({ message: "Restore completed.", summary });
  } catch (error) {
    if (error instanceof RestoreError) return fail(error.message, error.status);
    return handleError(error, "Restore", "A restored record conflicts with an existing record (duplicate code or number).");
  }
}
