import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function authorizeAdmin(): Promise<Response | null> {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}
