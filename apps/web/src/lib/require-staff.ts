import { auth } from "@/auth";
import type { UserRole } from "@workspace/domain/users";

export async function requireStaff(allowedRoles: UserRole[]): Promise<{ userId: string; role: UserRole }> {
  const session = await auth();
  if (!session || !session.user.id || !allowedRoles.includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  return { userId: session.user.id, role: session.user.role };
}
