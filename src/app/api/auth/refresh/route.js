import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/auth";

export async function POST() {
  try {
    const ok = await refreshSession();
    return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
  } catch {
    // Database hiccup: do NOT report "signed out"; the client simply tries again later.
    return NextResponse.json({ ok: true, transient: true });
  }
}
