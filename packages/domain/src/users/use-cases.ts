import type { UserRepository } from "./ports";
import type { User, UserRole } from "./entities";
import type { Locale } from "../shared";
import { hashPassword, verifyPassword } from "./auth";

export async function listActiveStaff(
  repo: UserRepository,
  role: Exclude<UserRole, "customer">,
): Promise<User[]> {
  return repo.listActiveByRole(role);
}

export async function registerCustomer(
  repo: UserRepository,
  input: { name: string; email: string; password: string; preferredLocale: Locale },
): Promise<User> {
  const existing = await repo.findByEmail(input.email);
  if (existing) throw new Error(`User already exists with email: ${input.email}`);
  const passwordHash = await hashPassword(input.password);
  return repo.create({
    name: input.name,
    email: input.email,
    role: "customer",
    pinHash: null,
    passwordHash,
    isActive: true,
    preferredLocale: input.preferredLocale,
    failedPinAttempts: 0,
    pinLockedUntil: null,
  });
}

export async function authenticateUser(
  repo: UserRepository,
  email: string,
  password: string,
): Promise<User | null> {
  const user = await repo.findByEmail(email);
  if (!user || !user.isActive || !user.passwordHash) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  return valid ? user : null;
}

export async function updateUserPreferredLocale(
  repo: UserRepository,
  userId: string,
  locale: Locale,
): Promise<User> {
  return repo.update(userId, { preferredLocale: locale });
}

const PIN_LOCKOUT_ATTEMPTS = 5;
const PIN_LOCKOUT_MINUTES = 15;

export function generatePin(): string {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
}

export async function authenticateStaffByPin(
  repo: UserRepository,
  email: string,
  pin: string,
): Promise<User | null> {
  const user = await repo.findByEmail(email);
  if (!user || !user.isActive || !user.pinHash) return null;
  if (user.role !== "despachador" && user.role !== "delivery") return null;
  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) return null;

  const valid = await verifyPassword(pin, user.pinHash);
  if (!valid) {
    const attempts = user.failedPinAttempts + 1;
    const lockedUntil =
      attempts >= PIN_LOCKOUT_ATTEMPTS ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60_000) : null;
    await repo.recordFailedPinAttempt(user.id, lockedUntil);
    return null;
  }

  await repo.resetPinAttempts(user.id);
  return user;
}

export async function registerStaffUser(
  repo: UserRepository,
  input: { name: string; email: string; role: Exclude<UserRole, "customer">; password: string },
): Promise<{ user: User; plainPin: string }> {
  const existing = await repo.findByEmail(input.email);
  if (existing) throw new Error(`User already exists with email: ${input.email}`);

  const passwordHash = await hashPassword(input.password);
  const plainPin = generatePin();
  const pinHash = await hashPassword(plainPin);

  const user = await repo.create({
    name: input.name,
    email: input.email,
    role: input.role,
    pinHash,
    passwordHash,
    isActive: true,
    preferredLocale: "es",
    failedPinAttempts: 0,
    pinLockedUntil: null,
  });

  return { user, plainPin };
}

export async function resetStaffPin(repo: UserRepository, userId: string): Promise<string> {
  const plainPin = generatePin();
  const pinHash = await hashPassword(plainPin);
  await repo.update(userId, { pinHash });
  await repo.resetPinAttempts(userId);
  return plainPin;
}
