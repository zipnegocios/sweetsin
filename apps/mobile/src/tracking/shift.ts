import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { apiFetch } from "../api/client";
import { rejectAfter, withTimeout } from "../hooks/with-timeout";
import { strings } from "../i18n";
import { canReport, shouldSendLocation, type TimedPosition } from "./send-policy";

export const LOCATION_TASK = "sweetsin-delivery-location";
const SHIFT_KEY = "sweetsin_shift_active";
const CONSENT_KEY = "sweetsin_shift_consent";
const POLICY = { minIntervalMs: 20_000, minDistanceMeters: 30 } as const;
const REQUEST_TIMEOUT_MS = 8_000;

export type StartResult = "started" | "foreground-only" | "foreground-denied" | "failed";

// Solo importa la última posición ENVIADA; vive en memoria (se pierde si el proceso muere, y está bien).
let lastSent: TimedPosition | null = null;
// Se pone en true al terminar el turno en ESTE proceso; la tarea headless (proceso nuevo) lo cubre con SHIFT_KEY.
let endedLocally = false;
const inFlight = new Set<Promise<unknown>>();
let watch: Location.LocationSubscription | null = null;

export async function hasShiftConsent(): Promise<boolean> {
  return (await SecureStore.getItemAsync(CONSENT_KEY)) === "1";
}

export async function saveShiftConsent(): Promise<void> {
  await SecureStore.setItemAsync(CONSENT_KEY, "1");
}

export async function isShiftActive(): Promise<boolean> {
  return (await SecureStore.getItemAsync(SHIFT_KEY)) === "1";
}

/** Aplica la política 20 s / 30 m y envía la posición; un fallo de red se descarta (sin cola). Devuelve true si el servidor respondió 401/403. */
async function send(location: Location.LocationObject): Promise<boolean> {
  const next: TimedPosition = { lat: location.coords.latitude, lng: location.coords.longitude, atMs: location.timestamp };
  const shiftFlagActive = await isShiftActive().catch(() => false);
  if (!canReport({ shiftFlagActive, trackingActive: !endedLocally, policyPasses: shouldSendLocation(lastSent, next, POLICY) })) return false;
  try {
    const res = await rejectAfter(
      apiFetch("/api/mobile/location", {
        method: "PUT",
        body: JSON.stringify({
          lat: next.lat,
          lng: next.lng,
          accuracyMeters: location.coords.accuracy ?? undefined,
          recordedAt: new Date(next.atMs).toISOString(),
        }),
      }),
      REQUEST_TIMEOUT_MS,
    );
    if (res.ok) lastSent = next;
    return res.status === 401 || res.status === 403;
  } catch {
    return false; // red caída o plazo vencido: se descarta; la próxima posición reemplaza a esta
  }
}

async function report(location: Location.LocationObject): Promise<void> {
  const p = send(location);
  inFlight.add(p);
  let unauthorized = false;
  try {
    unauthorized = await p;
  } finally {
    inFlight.delete(p);
  }
  if (unauthorized) await endShift();
}

/** Ejecutor de la tarea en segundo plano (se registra con defineTask en index.ts). Nunca lanza. */
export async function locationTaskExecutor(body: { data?: unknown; error?: unknown }): Promise<void> {
  try {
    if (body.error) return;
    const locations = (body.data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const latest = locations?.[locations.length - 1];
    if (latest) await report(latest);
  } catch {
    // nunca propagar fuera de la tarea
  }
}

async function startTracking(background: boolean): Promise<void> {
  if (background) {
    const t = strings.staffApp;
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: POLICY.minIntervalMs,
      distanceInterval: POLICY.minDistanceMeters,
      foregroundService: { notificationTitle: t.shiftNotificationTitle, notificationBody: t.shiftNotificationBody },
    });
  } else if (!watch) {
    watch = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: POLICY.minIntervalMs, distanceInterval: POLICY.minDistanceMeters },
      (l) => void report(l),
    );
  }
}

/** Pide permisos (primer plano y luego segundo plano) y arranca el seguimiento. Solo se llama al iniciar turno. */
export async function startShift(): Promise<StartResult> {
  try {
    endedLocally = false;
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return "foreground-denied";
    const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
    const background = bg?.granted === true;
    await startTracking(background);
    await SecureStore.setItemAsync(SHIFT_KEY, "1");
    return background ? "started" : "foreground-only";
  } catch {
    await stopTracking();
    return "failed";
  }
}

/** Tras un reinicio: si el turno estaba activo, reanuda el seguimiento sin pedir permisos. */
export async function resumeShift(): Promise<boolean> {
  try {
    if (!(await isShiftActive())) {
      await stopTracking(); // sin turno persistido no puede quedar una tarea del SO corriendo
      return false;
    }
    endedLocally = false;
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return true;
    const fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted) {
      await SecureStore.deleteItemAsync(SHIFT_KEY);
      return false;
    }
    const bg = await Location.getBackgroundPermissionsAsync();
    await startTracking(bg.granted);
    return true;
  } catch {
    return false;
  }
}

async function stopTracking(): Promise<void> {
  watch?.remove();
  watch = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    // ya detenida o módulo no disponible
  }
}

/** Termina el turno: detiene el seguimiento y, a mejor esfuerzo y con plazo, borra la posición del servidor. */
export async function endShift(): Promise<void> {
  endedLocally = true; // primero: ningún reporte nuevo sale desde acá
  await stopTracking();
  try {
    await SecureStore.deleteItemAsync(SHIFT_KEY);
  } catch {
    // resumeShift detiene la tarea si el flag falta; si no se pudo borrar, report() sigue bloqueado por endedLocally
  }
  await withTimeout(Promise.allSettled([...inFlight]), 3_000); // un PUT en vuelo no debe aterrizar después del DELETE
  lastSent = null;
  try {
    await rejectAfter(apiFetch("/api/mobile/location", { method: "DELETE" }), REQUEST_TIMEOUT_MS);
  } catch {
    // sin red: el servidor descarta la posición por antigüedad
  }
}
