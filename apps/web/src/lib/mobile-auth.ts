import { SignJWT, jwtVerify } from "jose";

const MOBILE_JWT_TTL = "12h";

function getMobileJwtSecret(): Uint8Array {
  const secret = process.env.MOBILE_JWT_SECRET;
  if (!secret) throw new Error("MOBILE_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signMobileJwt(payload: { sub: string; role: "despachador" | "delivery" }): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(MOBILE_JWT_TTL)
    .sign(getMobileJwtSecret());
}

export async function verifyMobileJwt(token: string): Promise<{ sub: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getMobileJwtSecret());
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}
