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
}
