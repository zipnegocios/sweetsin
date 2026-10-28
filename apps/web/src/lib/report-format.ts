import { adelaideDayKey } from "./adelaide-time";

/** Duración en ms -> partes para i18n: minutos y segundos enteros (redondeo al segundo). */
export function durationParts(ms: number): { m: number; s: number } {
  const total = Math.round(ms / 1000);
  return { m: Math.floor(total / 60), s: total % 60 };
}

/** Rango por defecto del reporte: los últimos 7 días de Adelaida, hoy incluido. */
export function defaultReportRange(now: Date = new Date()): { from: string; to: string } {
  const to = adelaideDayKey(now);
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}
