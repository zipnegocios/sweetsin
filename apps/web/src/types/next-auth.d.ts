import type { UserRole } from "@workspace/domain/users";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: UserRole;
      preferredLocale: "en" | "es";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    preferredLocale?: "en" | "es";
  }
}
