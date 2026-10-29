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

/**
 * Opciones de parada del reporte: paradas del trailer y jornadas de delivery (con su etiqueta
 * propia), así agrupar o filtrar por parada nunca muestra un UUID.
 */
export function reportStopOptions(
  trailerStops: { id: string; location: string; startTime: Date }[],
  jornadas: { id: string; location: string; startTime: Date }[],
  formatDate: (d: Date) => string,
  jornadaLabel: (name: string) => string,
): { id: string; label: string }[] {
  return [
    ...trailerStops.map((s) => ({ id: s.id, label: `${s.location} · ${formatDate(s.startTime)}` })),
    ...jornadas.map((j) => ({ id: j.id, label: `${jornadaLabel(j.location)} · ${formatDate(j.startTime)}` })),
  ];
}
