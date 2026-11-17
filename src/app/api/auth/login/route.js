import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAdminSession } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();

    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email aur password required hain." },
        { status: 400 },
      );
    }

    const admin = await prisma.platformAdmin.findUnique({
      where: { email },
    });

    if (!admin || !admin.isActive || admin.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { message: "Invalid email ya password." },
        { status: 401 },
      );
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: "Invalid email ya password." },
        { status: 401 },
      );
    }

    await createAdminSession(admin);

    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: "Login successful.",
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return NextResponse.json(
      { message: "Login process mein error aa gaya." },
      { status: 500 },
    );
  }
}
