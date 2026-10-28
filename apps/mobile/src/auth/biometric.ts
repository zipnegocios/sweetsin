import * as SecureStore from "expo-secure-store";

// El PIN y el email quedan en el Keystore de Android protegidos con la huella (`requireAuthentication`):
// ni siquiera la app puede leerlos sin que el usuario se autentique. Si el usuario registra otra huella,
// Android invalida la clave y `getItemAsync` devuelve null; la app vuelve al PIN sin dejar nada usable.
// Revocar = borrar la entrada (y como el PIN guardado es el real, cambiarlo desde el admin o la app la deja obsoleta).
const CREDENTIALS_KEY = "sweetsin_biometric_credentials";
const ENABLED_KEY = "sweetsin_biometric_enabled"; // bandera sin protección: la pantalla de login decide si ofrece el botón sin pedir la huella
const DECLINED_KEY = "sweetsin_biometric_declined"; // el usuario ya dijo "ahora no" a la oferta tras el login
const KEYCHAIN_SERVICE = "sweetsin-biometric";

export type BiometricCredentials = { email: string; pin: string };

export type BiometricRead =
  | { status: "ok"; credentials: BiometricCredentials }
  | { status: "cancelled" } // el usuario canceló o falló la huella: no se toca nada
  | { status: "invalidated" }; // la clave ya no existe (huella nueva, borrado de huellas): se desactiva sola

const protectedOptions = (prompt: string) => ({
  keychainService: KEYCHAIN_SERVICE,
  requireAuthentication: true,
  authenticationPrompt: prompt,
});

/** `true` si el teléfono tiene sensor y una huella registrada con seguridad suficiente. */
export function isBiometricSupported(): boolean {
  try {
    return SecureStore.canUseBiometricAuthentication();
  } catch {
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ENABLED_KEY)) === "1";
}

/** Guarda (o reemplaza) las credenciales protegidas con la huella. Pide la huella al escribir; rechaza si se cancela. */
export async function enableBiometric(credentials: BiometricCredentials, prompt: string): Promise<void> {
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(credentials), protectedOptions(prompt));
  await SecureStore.setItemAsync(ENABLED_KEY, "1");
  await SecureStore.deleteItemAsync(DECLINED_KEY);
}

export async function disableBiometric(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(CREDENTIALS_KEY, { keychainService: KEYCHAIN_SERVICE }),
    SecureStore.deleteItemAsync(ENABLED_KEY),
  ]);
}

function parseCredentials(raw: string): BiometricCredentials | null {
  try {
    const { email, pin } = JSON.parse(raw) as Partial<BiometricCredentials>;
    return typeof email === "string" && typeof pin === "string" ? { email, pin } : null;
  } catch {
    return null;
  }
}

/** Pide la huella y devuelve las credenciales guardadas. */
export async function readBiometricCredentials(prompt: string): Promise<BiometricRead> {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(CREDENTIALS_KEY, protectedOptions(prompt));
  } catch {
    return { status: "cancelled" };
  }
  const credentials = raw === null ? null : parseCredentials(raw);
  if (!credentials) {
    await disableBiometric();
    return { status: "invalidated" };
  }
  return { status: "ok", credentials };
}

export async function wasBiometricOfferDeclined(): Promise<boolean> {
  return (await SecureStore.getItemAsync(DECLINED_KEY)) === "1";
}

export async function markBiometricOfferDeclined(): Promise<void> {
  await SecureStore.setItemAsync(DECLINED_KEY, "1");
}
