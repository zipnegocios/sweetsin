import { createContext, useContext } from "react";

/** `logout` es el único cierre de sesión (botón o 401): borra la caché de órdenes, el token y el rol cacheado. */
type AuthContextValue = { logout: () => Promise<void> };

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthContext.Provider");
  return ctx;
}
