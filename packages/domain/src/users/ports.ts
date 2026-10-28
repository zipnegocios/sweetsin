import type { User, UserRole } from "./entities";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  listActiveByRole(role: UserRole): Promise<User[]>;
  listByRole(role: UserRole): Promise<User[]>;
  create(user: Omit<User, "id">): Promise<User>;
  update(
    id: string,
    data: Partial<
      Pick<
        User,
        | "name"
        | "email"
        | "role"
        | "passwordHash"
        | "preferredLocale"
        | "pinHash"
        | "isActive"
        | "phone"
        | "emergencyContactName"
        | "emergencyContactPhone"
        | "internalNotes"
        | "photoKey"
      >
    >,
  ): Promise<User>;
  recordFailedPinAttempt(id: string, lockedUntil: Date | null): Promise<void>;
  resetPinAttempts(id: string): Promise<void>;
  /** Elimina al usuario y libera todo lo que lo referencia (asignaciones, tokens, ubicación). */
  deleteStaff(id: string): Promise<void>;
}

/** Almacén de fotos del staff (bucket de assets, privado). Las keys son relativas; el adaptador añade el prefijo. */
export interface StaffPhotoStorage {
  put(key: string, body: Uint8Array, contentType: "image/jpeg"): Promise<void>;
  delete(key: string): Promise<void>;
  /** URL temporal de lectura (el bucket no es público). */
  createViewUrl(key: string): Promise<string>;
}
