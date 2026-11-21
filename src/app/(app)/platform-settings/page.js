import { requireContext } from "@/lib/scope";
import SettingsForm from "@/components/modules/settings-forms";

export const instant = false;

export default async function PlatformSettingsPage() {
  await requireContext(["SUPER_ADMIN"]);
  // Only booleans are sent to the browser, never the secrets themselves.
  const health = [
    { label: "AUTH_SECRET (session signing)", ok: Boolean(process.env.AUTH_SECRET), hint: "Set AUTH_SECRET in the environment." },
    { label: "CREDENTIALS_ENCRYPTION_KEY (view credentials feature)", ok: Boolean(process.env.CREDENTIALS_ENCRYPTION_KEY), hint: "Set CREDENTIALS_ENCRYPTION_KEY to enable password viewing." },
    { label: "DATABASE_URL", ok: Boolean(process.env.DATABASE_URL), hint: "Database connection missing." },
  ];
  return <SettingsForm kind="platform" health={health} />;
}
