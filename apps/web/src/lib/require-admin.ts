import { auth } from "@/auth";

export async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    throw new Error("Forbidden");
  }
}
