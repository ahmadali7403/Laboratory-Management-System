import { prisma } from "@/lib/prisma";
import { apiContext } from "@/lib/scope";
import { fail, handleError, isUuid, json } from "@/lib/http";
import { VIEW_DEFS } from "@/lib/view-defs";

// JSON version of the record detail page, used by the View modal.
// Same definitions (VIEW_DEFS) and the same authority filter as /view/<module>/<id>:
// access-by-id is restricted to what the signed-in actor may see (no cross-tenant reads).
const read = (row, key) => (typeof key === "function" ? key(row) : row[key]);

export async function GET(request, { params }) {
  try {
    const { module, id } = await params;
    const auth = await apiContext(request);
    if (auth.error) return auth.error;
    const def = VIEW_DEFS[module];
    if (!def || !isUuid(id)) return fail("Record not found.", 404);

    const row = await prisma[def.model].findFirst({
      where: { id, ...def.where(auth.ctx.actor) },
      include: def.include,
    });
    if (!row) return fail("Record not found.", 404);

    const cell = (r, [label, key, kind = "t", link]) => {
      const value = read(r, key);
      return { label, kind, value: value ?? null, href: link && value ? link(r) : null };
    };
    return json({
      title: def.title,
      back: def.back,
      fields: def.fields.map((f) => cell(row, f)),
      summary: (def.summary ? def.summary(row) : []).map(([label, value, kind = "t"]) => ({ label, value, kind })),
      tables: (def.tables || []).map((t) => ({
        title: t.title,
        cols: t.cols.map(([label, , kind = "t"]) => ({ label, kind })),
        rows: t.rows(row).map((r) => t.cols.map((c) => {
          const { value, href } = cell(r, c);
          return { value, href };
        })),
      })),
      links: def.extraLinks ? def.extraLinks(row).map(([label, href]) => ({ label, href })) : [],
    });
  } catch (error) {
    return handleError(error, "Record view");
  }
}
