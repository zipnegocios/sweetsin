import type { Locale } from "../shared";

export type UserRole = "admin" | "despachador" | "delivery" | "customer";

export interface User {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  pinHash: string | null;
  passwordHash: string | null;
  isActive: boolean;
  preferredLocale: Locale;
  failedPinAttempts: number;
  pinLockedUntil: Date | null;
  // Ficha del staff: opcionales para no obligar a clientes ni fixtures a declararlos.
  phone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  internalNotes?: string | null;
  /** Key relativa dentro del bucket de assets (el prefijo lo pone el adaptador). */
  photoKey?: string | null;
}

export type StaffRole = Extract<UserRole, "despachador" | "delivery">;
