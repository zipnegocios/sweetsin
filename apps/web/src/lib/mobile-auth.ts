import { SignJWT, jwtVerify } from "jose";
import { createHmac, timingSafeEqual } from "node:crypto";

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

export function verifyAppSignature(signature: string, rawBody: string): boolean {
  const secret = process.env.EXPO_PUBLIC_APP_SECRET;
  if (!secret) throw new Error("EXPO_PUBLIC_APP_SECRET is not set");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
