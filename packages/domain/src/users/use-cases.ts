import type { StaffPhotoStorage, UserRepository } from "./ports";
import type { StaffRole, User, UserRole } from "./entities";
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

const PIN_PATTERN = /^\d{6}$/;

export const isValidPin = (pin: string): boolean => PIN_PATTERN.test(pin);

const PIN_ERROR = "PIN must be exactly 6 digits";

/** Comprueba el PIN aplicando el bloqueo temporal y el conteo de fallos. Una sola regla para login y autoservicio. */
async function checkStaffPin(repo: UserRepository, user: User, pin: string): Promise<boolean> {
  if (!user.isActive || !user.pinHash) return false;
  if (user.role !== "despachador" && user.role !== "delivery") return false;
  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) return false;

  const valid = await verifyPassword(pin, user.pinHash);
  if (!valid) {
    const attempts = user.failedPinAttempts + 1;
    const lockedUntil =
      attempts >= PIN_LOCKOUT_ATTEMPTS ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60_000) : null;
    await repo.recordFailedPinAttempt(user.id, lockedUntil);
    return false;
  }

  await repo.resetPinAttempts(user.id);
  return true;
}

export async function authenticateStaffByPin(
  repo: UserRepository,
  email: string,
  pin: string,
): Promise<User | null> {
  const user = await repo.findByEmail(email);
  return user && (await checkStaffPin(repo, user, pin)) ? user : null;
}

/** Verifica el PIN de una sesión ya autenticada (por id). Mismo bloqueo temporal que el login. */
export async function verifyStaffPin(repo: UserRepository, userId: string, pin: string): Promise<User | null> {
  const user = await repo.findById(userId);
  return user && (await checkStaffPin(repo, user, pin)) ? user : null;
}

export async function changeStaffPin(
  repo: UserRepository,
  userId: string,
  currentPin: string,
  newPin: string,
): Promise<void> {
  if (!isValidPin(newPin)) throw new Error(PIN_ERROR);
  if (!(await verifyStaffPin(repo, userId, currentPin))) throw new Error("Current PIN is incorrect");
  await repo.update(userId, { pinHash: await hashPassword(newPin) });
}

const MIN_PASSWORD_LENGTH = 8;

export async function changeStaffPassword(
  repo: UserRepository,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  const user = await findStaff(repo, userId);
  if (!user.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new Error("Current password is incorrect");
  }
  await repo.update(userId, { passwordHash: await hashPassword(newPassword) });
}

export async function registerStaffUser(
  repo: UserRepository,
  input: { name: string; email: string; role: Exclude<UserRole, "customer">; password: string; pin?: string },
): Promise<{ user: User; plainPin: string }> {
  if (input.pin !== undefined && !isValidPin(input.pin)) throw new Error(PIN_ERROR);
  const existing = await repo.findByEmail(input.email);
  if (existing) throw new Error(`User already exists with email: ${input.email}`);

  const passwordHash = await hashPassword(input.password);
  const plainPin = input.pin ?? generatePin();
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

/** Sin `pin` genera uno aleatorio; con `pin` fija el que escribió el admin. Devuelve el PIN en texto plano. */
export async function resetStaffPin(repo: UserRepository, userId: string, pin?: string): Promise<string> {
  if (pin !== undefined && !isValidPin(pin)) throw new Error(PIN_ERROR);
  const plainPin = pin ?? generatePin();
  const pinHash = await hashPassword(plainPin);
  await repo.update(userId, { pinHash });
  await repo.resetPinAttempts(userId);
  return plainPin;
}

export async function deleteStaffUser(
  repo: UserRepository,
  userId: string,
  photos?: StaffPhotoStorage,
): Promise<void> {
  const user = await repo.findById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  if (user.role !== "despachador" && user.role !== "delivery") {
    throw new Error("Only staff users can be deleted");
  }
  await repo.deleteStaff(userId);
  // Después de la DB: si el borrado del objeto falla solo queda un archivo huérfano, nunca un usuario con foto rota.
  if (user.photoKey && photos) await photos.delete(user.photoKey).catch(() => {});
}

export interface StaffProfileInput {
  name: string;
  email: string;
  role: StaffRole;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  internalNotes: string | null;
  preferredLocale: Locale;
  /** Solo se cambia la contraseña si viene con contenido. */
  password?: string;
}

const optionalText = (value: string | null): string | null => value?.trim() || null;

async function findStaff(repo: UserRepository, userId: string): Promise<User> {
  const user = await repo.findById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  if (user.role !== "despachador" && user.role !== "delivery") throw new Error("Only staff users can be edited");
  return user;
}

export async function updateStaffProfile(
  repo: UserRepository,
  userId: string,
  input: StaffProfileInput,
): Promise<User> {
  const user = await findStaff(repo, userId);

  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const email = input.email.trim();
  if (!email) throw new Error("Email is required");
  if (input.role !== "despachador" && input.role !== "delivery") throw new Error("Invalid staff role");

  if (email !== user.email) {
    const existing = await repo.findByEmail(email);
    if (existing && existing.id !== userId) throw new Error(`User already exists with email: ${email}`);
  }

  const password = input.password?.trim();
  return repo.update(userId, {
    name,
    email,
    role: input.role,
    phone: optionalText(input.phone),
    emergencyContactName: optionalText(input.emergencyContactName),
    emergencyContactPhone: optionalText(input.emergencyContactPhone),
    internalNotes: optionalText(input.internalNotes),
    preferredLocale: input.preferredLocale,
    ...(password ? { passwordHash: await hashPassword(password) } : {}),
  });
}

// La web redimensiona a ~600 px antes de subir, así que 2 MB es un tope generoso.
export const MAX_STAFF_PHOTO_BYTES = 2 * 1024 * 1024;

const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

interface PhotoDeps {
  users: UserRepository;
  photos: StaffPhotoStorage;
}

export async function replaceStaffPhoto({ users, photos }: PhotoDeps, userId: string, jpeg: Uint8Array): Promise<User> {
  const user = await findStaff(users, userId);
  if (!isJpeg(jpeg)) throw new Error("Photo must be a JPEG image");
  if (jpeg.length > MAX_STAFF_PHOTO_BYTES) throw new Error("Photo is too large");

  const key = `${userId}/${Date.now()}.jpg`;
  await photos.put(key, jpeg, "image/jpeg");
  const updated = await users.update(userId, { photoKey: key });
  if (user.photoKey) await photos.delete(user.photoKey).catch(() => {});
  return updated;
}

export async function removeStaffPhoto({ users, photos }: PhotoDeps, userId: string): Promise<User> {
  const user = await findStaff(users, userId);
  const updated = await users.update(userId, { photoKey: null });
  if (user.photoKey) await photos.delete(user.photoKey).catch(() => {});
  return updated;
}
