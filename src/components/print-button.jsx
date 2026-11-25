"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

export default function PrintBar({ backHref, backLabel }) {
  // Inside the View modal (iframe) there is nothing to go "back" to; only Print is shown.
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => { setEmbedded(window.self !== window.top); }, []);
  return (
    <div className={`mb-4 flex items-center print:hidden ${embedded ? "justify-end" : "justify-between"}`}>
      {!embedded && <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft size={15} /> {backLabel}</Link>}
      <button onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><Printer size={15} /> Print</button>
    </div>
  );
}
