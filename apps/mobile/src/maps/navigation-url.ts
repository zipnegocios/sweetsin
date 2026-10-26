import type { LatLng } from "./types";

/** Google Maps en modo conducir: al destino de la ruta si ya se calculo; si no, a la direccion escrita. */
export function navigationUrl(destination: LatLng | null, address: string): string {
  const target = destination ? `${destination.lat},${destination.lng}` : encodeURIComponent(address);
  return `https://www.google.com/maps/dir/?api=1&destination=${target}&travelmode=driving`;
}
