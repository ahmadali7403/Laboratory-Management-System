import { notFound } from "next/navigation";
import { requireContext } from "@/lib/scope";
import { REPORT_MODULES } from "@/lib/report-engine";
import ReportViewer from "@/components/modules/report-viewer";

export const instant = false;

export default async function ReportModulePage({ params }) {
  await requireContext();
  const { module } = await params;
  const meta = REPORT_MODULES.find((m) => m.key === module);
  if (!meta) notFound();
  return <ReportViewer module={meta.key} title={meta.title} entity={meta.entity} modules={REPORT_MODULES.map(({ key, title }) => ({ key, title }))} />;
}
