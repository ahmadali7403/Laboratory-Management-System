"use client";

import { usePathname } from "next/navigation";

const POS_ROUTES = new Set(["/pharmacy/pos", "/orders/new"]);

export default function AppMain({ children }) {
  const pathname = usePathname();
  const isPos = POS_ROUTES.has(pathname);

  if (isPos) {
    return (
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
        {children}
      </main>
    );
  }

  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto print:overflow-visible">
      <div className="mx-auto w-full min-w-0 max-w-[1800px] p-2 sm:p-2.5 lg:p-3 print:max-w-none print:p-0">
        {children}
      </div>
    </main>
  );
}
