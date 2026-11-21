import { NextResponse } from "next/server";
import { destroyAdminSession, destroyUserSession } from "@/lib/auth";

export async function POST() {
  await destroyAdminSession();
  await destroyUserSession();
  return NextResponse.json({ success: true, message: "Logged out successfully." });
}
