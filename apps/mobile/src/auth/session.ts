import * as SecureStore from "expo-secure-store";
import { isStaffRole, type StaffRole } from "./startup";

const TOKEN_KEY = "sweetsin_mobile_jwt";
const ROLE_KEY = "sweetsin_mobile_role"; // permite entrar sin red con la sesión guardada

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveRole(role: StaffRole): Promise<void> {
  await SecureStore.setItemAsync(ROLE_KEY, role);
}

export async function getCachedRole(): Promise<StaffRole | null> {
  const role = await SecureStore.getItemAsync(ROLE_KEY);
  return isStaffRole(role) ? role : null;
}

/** Borra el token y el rol cacheado. */
export async function clearSession(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(ROLE_KEY)]);
}
