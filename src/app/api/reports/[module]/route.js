import { apiContext } from "@/lib/scope";
import { fail, handleError, json } from "@/lib/http";
import { REPORT_MODULES, listEntities, runReport } from "@/lib/report-engine";

/**
 * GET /api/reports/<module>
 *   ?mode=combined|individual   &from=YYYY-MM-DD &to=YYYY-MM-DD   &id=<record>
 *   ?entities=1&q=<text>        -> records for the "Individual report" picker
 * All data is filtered by the verified scope of the signed-in role.
 */
export async function GET(request, { params }) {
  try {
    const { module } = await params;
    if (!REPORT_MODULES.some((m) => m.key === module)) return fail("Unknown report.", 404);
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const sp = new URL(request.url).searchParams;

    if (sp.get("entities") === "1") {
      const items = await listEntities(auth.ctx, module, sp.get("q") || "");
      return json({ items });
    }
    const mode = sp.get("mode") === "individual" ? "individual" : "combined";
    const res = await runReport(auth.ctx, module, { mode, id: sp.get("id"), from: sp.get("from"), to: sp.get("to") });
    if (res.error) return fail(res.error, res.status || 400);
    return json(res.report);
  } catch (error) {
    return handleError(error, "Report");
  }
}
