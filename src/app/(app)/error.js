"use client";

import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

// Friendly fallback if a page fails to load. Never shows raw error details to the user.
export default function AppError({ reset }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <AlertTriangle size={22} />
      </span>
      <h2 className="mt-4 text-lg font-bold text-slate-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-slate-500">
        This page could not be loaded. Your data is safe. Please try again.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <RotateCw size={15} /> Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
