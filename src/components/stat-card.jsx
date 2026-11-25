import Link from "next/link";

const TONES = {
  blue: "bg-blue-50 text-blue-600", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600", rose: "bg-rose-50 text-rose-600", slate: "bg-slate-100 text-slate-600",
};

export default function StatCard({ icon: Icon, label, value, tone = "blue", hint, href }) {
  const card = (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${href ? "transition hover:border-blue-300 hover:shadow-md" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
        </div>
        {Icon && <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}><Icon size={19} /></span>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-blue-500">
      {card}
    </Link>
  ) : (
    card
  );
}

export const money = (n) => `Rs ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
