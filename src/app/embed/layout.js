import { connection } from "next/server";

export const instant = false;

// Bare layout (no sidebar / header) for documents shown inside the View modals.
// Pages below still call requireContext(), so authentication is enforced exactly as in the app.
export default async function EmbedLayout({ children }) {
  await connection();
  return <div className="min-h-screen bg-white p-2">{children}</div>;
}
