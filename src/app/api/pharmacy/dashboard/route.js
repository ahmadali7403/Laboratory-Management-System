import { apiContext } from "@/lib/scope";
import { handleError, json } from "@/lib/http";
import { getPharmacyDashboard } from "@/lib/pharmacy-stats";

export async function GET(request) {
  try {
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const data = await getPharmacyDashboard(auth.ctx.scope);
    return json(data);
  } catch (error) {
    return handleError(error, "Pharmacy dashboard");
  }
}
