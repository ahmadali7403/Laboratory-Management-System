"use client";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

export default function PrintBar({ backHref, backLabel }) {
  return (
    <div className="mb-4 flex items-center justify-between print:hidden">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft size={15} /> {backLabel}</Link>
      <button onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><Printer size={15} /> Print</button>
    </div>
  );
}
