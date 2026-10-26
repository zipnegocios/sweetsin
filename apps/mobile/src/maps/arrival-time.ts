import type { Locale } from "@workspace/i18n";

/** Más viejo que esto, la tarjeta avisa "Ruta desactualizada". */
export const ROUTE_STALE_MS = 5 * 60_000;

/** Edad del cálculo de la ruta en ms (nunca negativa), o null si `computedAt` no es una fecha válida. */
export function routeAgeMs(computedAt: string, now: Date): number | null {
  const computed = Date.parse(computedAt);
  return Number.isNaN(computed) ? null : Math.max(0, now.getTime() - computed);
}

/**
 * Tiempo restante descontando lo transcurrido desde que el servidor calculó el ETA (sin red el último cálculo
 * envejece): así "N min" y "Llegás a las HH:MM" no se contradicen. Un reloj atrasado no suma tiempo.
 */
export function routeTiming(
  etaSeconds: number,
  computedAt: string,
  now: Date,
): { remainingSeconds: number; stale: boolean } {
  const elapsedMs = routeAgeMs(computedAt, now);
  if (elapsedMs === null) return { remainingSeconds: etaSeconds, stale: false };
  return { remainingSeconds: Math.max(0, etaSeconds - elapsedMs / 1000), stale: elapsedMs > ROUTE_STALE_MS };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Hora local de llegada (now + ETA, al minuto mas cercano): "14:35" en es, "2:35 PM" en en. */
export function formatArrival(etaSeconds: number, now: Date, locale: Locale): string {
  const minutes = Math.round((now.getTime() + etaSeconds * 1000) / 60_000);
  const at = new Date(minutes * 60_000);
  const h = at.getHours();
  if (locale === "es") return `${pad(h)}:${pad(at.getMinutes())}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(at.getMinutes())} ${h < 12 ? "AM" : "PM"}`;
}
