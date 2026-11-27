import { apiContext } from "@/lib/scope";
import { fail, handleError, json } from "@/lib/http";
import { PHARMACY_REPORT_TYPES, runPharmacyReport } from "@/lib/pharmacy-reports";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const sp = new URL(request.url).searchParams;
    const type = sp.get("type") || "sales";
    if (!PHARMACY_REPORT_TYPES.some((t) => t.key === type)) return fail("Unknown pharmacy report type.", 404);
    const data = await runPharmacyReport(auth.ctx.scope, type, { from: sp.get("from"), to: sp.get("to") });
    return json({ ...data, type, types: PHARMACY_REPORT_TYPES });
  } catch (error) {
    return handleError(error, "Pharmacy report");
  }
}
