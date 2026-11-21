import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiContext } from "@/lib/scope";
import { handleError, json, parseBody, req } from "@/lib/http";

const DEFAULTS = { platformName: "LabOS", supportEmail: "", defaultCountry: "Pakistan" };

export async function GET(request) {
  try {
    const auth = await apiContext(request, { roles: ["SUPER_ADMIN"] });
    if (auth.error) return auth.error;
    const rows = await prisma.platformSetting.findMany();
    return json({ ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  } catch (error) {
    return handleError(error, "Platform settings");
  }
}

const schema = z.object({
  platformName: req(2, 60, "Platform name"),
  supportEmail: z.string().trim().email("Invalid email address.").max(120).or(z.literal("")),
  defaultCountry: req(2, 60, "Default country"),
});

export async function PATCH(request) {
  try {
    const auth = await apiContext(request, { roles: ["SUPER_ADMIN"] });
    if (auth.error) return auth.error;
    const parsed = await parseBody(request, schema);
    if (parsed.error) return parsed.error;
    await prisma.$transaction(
      Object.entries(parsed.data).map(([key, value]) =>
        prisma.platformSetting.upsert({ where: { key }, update: { value }, create: { key, value } }),
      ),
    );
    return json({ ...parsed.data, message: "Platform settings saved." });
  } catch (error) {
    return handleError(error, "Platform settings update");
  }
}
