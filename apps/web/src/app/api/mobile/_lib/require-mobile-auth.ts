import { verifyMobileJwt } from "@/lib/mobile-auth";
import { DrizzleUserRepository } from "@workspace/db/repositories";

export async function requireMobileAuth(
  req: Request,
): Promise<{ userId: string; role: "despachador" | "delivery" } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length);
  const payload = await verifyMobileJwt(token);
  if (!payload || (payload.role !== "despachador" && payload.role !== "delivery")) return null;

  const user = await new DrizzleUserRepository().findById(payload.sub);
  if (!user || !user.isActive) return null;

  return { userId: user.id, role: payload.role };
}
