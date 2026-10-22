import type { Locale } from "@workspace/i18n";

/** "12 min · 3.4 km" (en) / "12 min · 3,4 km" (es); "< 1 min", "1 h", "1 h 5 min", "850 m". */
export function formatEta(etaSeconds: number, distanceMeters: number, locale: Locale): string {
  const minutesTotal = Math.round(etaSeconds / 60);
  let time: string;
  if (etaSeconds < 60) time = "< 1 min";
  else if (minutesTotal >= 60) {
    const minutes = minutesTotal % 60;
    time = minutes === 0 ? `${minutesTotal / 60} h` : `${Math.floor(minutesTotal / 60)} h ${minutes} min`;
  } else time = `${minutesTotal} min`;

  let distance: string;
  if (Math.round(distanceMeters) < 1000) distance = `${Math.round(distanceMeters)} m`;
  else {
    distance = `${(distanceMeters / 1000).toFixed(1)} km`;
    if (locale === "es") distance = distance.replace(".", ",");
  }
  return `${time} · ${distance}`;
}
