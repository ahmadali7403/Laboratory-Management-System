import { requireContext } from "@/lib/scope";
import NotificationsList from "@/components/modules/notifications-list";

export const instant = false;

export default async function NotificationsPage() {
  await requireContext(["SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN", "STAFF"]);
  return <NotificationsList />;
}
