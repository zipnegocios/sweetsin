import { createContext, useContext } from "react";

export const AuthContext = createContext<{ logout: () => void } | null>(null);

export function useAuth(): { logout: () => void } {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthContext.Provider");
  return ctx;
}
