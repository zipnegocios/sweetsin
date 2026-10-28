import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  items: new Map<string, string>(),
  supported: true,
  failReadWith: null as Error | null,
  writes: [] as { key: string; options?: Record<string, unknown> }[],
}));

vi.mock("expo-secure-store", () => ({
  canUseBiometricAuthentication: () => {
    if (!store.supported) throw new Error("unavailable");
    return store.supported;
  },
  getItemAsync: async (key: string) => {
    if (store.failReadWith && key.endsWith("credentials")) throw store.failReadWith;
    return store.items.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string, options?: Record<string, unknown>) => {
    store.writes.push({ key, options });
    store.items.set(key, value);
  },
  deleteItemAsync: async (key: string) => void store.items.delete(key),
}));

import {
  disableBiometric,
  enableBiometric,
  isBiometricEnabled,
  isBiometricSupported,
  markBiometricOfferDeclined,
  readBiometricCredentials,
  wasBiometricOfferDeclined,
} from "./biometric";

const creds = { email: "ana@sweetsin.com", pin: "123456" };

beforeEach(() => {
  store.items.clear();
  store.writes = [];
  store.supported = true;
  store.failReadWith = null;
});

describe("biometric", () => {
  it("las credenciales se guardan siempre protegidas con la huella", async () => {
    await enableBiometric(creds, "Confirma");

    const credentialWrite = store.writes.find((w) => w.key.endsWith("credentials"))!;
    expect(credentialWrite.options).toMatchObject({ requireAuthentication: true, authenticationPrompt: "Confirma" });
    expect(await isBiometricEnabled()).toBe(true);
  });

  it("lee de vuelta las credenciales guardadas", async () => {
    await enableBiometric(creds, "Confirma");

    expect(await readBiometricCredentials("Entra")).toEqual({ status: "ok", credentials: creds });
  });

  it("si el usuario cancela la huella no se desactiva nada", async () => {
    await enableBiometric(creds, "Confirma");
    store.failReadWith = new Error("user cancelled");

    expect(await readBiometricCredentials("Entra")).toEqual({ status: "cancelled" });
    expect(await isBiometricEnabled()).toBe(true);
  });

  it("si la clave fue invalidada (huella nueva) se desactiva sola", async () => {
    await enableBiometric(creds, "Confirma");
    store.items.delete("sweetsin_biometric_credentials"); // getItemAsync → null, como en una clave invalidada

    expect(await readBiometricCredentials("Entra")).toEqual({ status: "invalidated" });
    expect(await isBiometricEnabled()).toBe(false);
  });

  it("un contenido corrupto se trata como invalidado", async () => {
    store.items.set("sweetsin_biometric_credentials", "no-es-json");
    store.items.set("sweetsin_biometric_enabled", "1");

    expect(await readBiometricCredentials("Entra")).toEqual({ status: "invalidated" });
    expect(await isBiometricEnabled()).toBe(false);
  });

  it("disableBiometric revoca: borra las credenciales y la bandera", async () => {
    await enableBiometric(creds, "Confirma");

    await disableBiometric();

    expect(store.items.size).toBe(0);
  });

  it("activarla de nuevo limpia el 'ahora no' de la oferta", async () => {
    await markBiometricOfferDeclined();
    expect(await wasBiometricOfferDeclined()).toBe(true);

    await enableBiometric(creds, "Confirma");

    expect(await wasBiometricOfferDeclined()).toBe(false);
  });

  it("isBiometricSupported es false si el módulo lanza (sin sensor o sin huella)", () => {
    store.supported = false;
    expect(isBiometricSupported()).toBe(false);
  });
});
