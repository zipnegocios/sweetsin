export type PhotoOutcome = "ok" | "tooLarge" | "error";

/** 413 = foto pesada (se reintenta con otra toma); el resto de fallos es red o servidor. */
export function classifyPhotoResponse(status: number): PhotoOutcome {
  if (status >= 200 && status < 300) return "ok";
  return status === 413 ? "tooLarge" : "error";
}

/** Lado (px) de la foto de perfil subida: el mismo que recorta la web. */
export const PROFILE_PHOTO_SIDE = 600;

/** Bytes de un base64 (lo que devuelve el recorte): el `fetch` de Expo no sube archivos por `uri`, solo bytes. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Cuadrado central de una imagen rectangular (lo que muestra el círculo de la credencial). */
export function centerSquare(width: number, height: number): { originX: number; originY: number; width: number; height: number } {
  const side = Math.min(width, height);
  return { originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side };
}
