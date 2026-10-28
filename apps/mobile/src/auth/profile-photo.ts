import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { apiFetch } from "../api/client";
import { base64ToBytes, centerSquare, classifyPhotoResponse, PROFILE_PHOTO_SIDE, type PhotoOutcome } from "./photo-rules";

/** Foto existente de la galería, cuadrada. El selector del sistema no pide permiso en Android. */
export async function pickProfilePhotoFromGallery(): Promise<{ uri: string } | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
  return picked.canceled || !picked.assets[0] ? null : { uri: picked.assets[0].uri };
}

/** Recorta el cuadrado central y reduce a 600 px JPEG (igual que la web): pesa unas decenas de KB y cabe de sobra en el tope del servidor. */
export async function prepareProfilePhoto(uri: string): Promise<Uint8Array> {
  const base = await ImageManipulator.manipulate(uri).renderAsync(); // dimensiones ya con la orientación aplicada
  const context = ImageManipulator.manipulate(uri).crop(centerSquare(base.width, base.height)).resize({ width: PROFILE_PHOTO_SIDE });
  const out = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  return base64ToBytes(out.base64 ?? "");
}

/** `detail` (código HTTP o error de red) es solo para diagnóstico en el aviso. */
export async function uploadProfilePhoto(jpeg: Uint8Array): Promise<{ outcome: PhotoOutcome; detail: string }> {
  try {
    const response = await apiFetch("/api/mobile/account/photo", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: jpeg as unknown as BodyInit });
    const reason = response.ok ? "" : ` ${(await response.text().catch(() => "")).slice(0, 80)}`; // el servidor explica el 400 (p. ej. "Photo must be a JPEG image")
    return { outcome: classifyPhotoResponse(response.status), detail: `HTTP ${response.status}${reason}` };
  } catch (error) {
    return { outcome: "error", detail: `red: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function removeProfilePhoto(): Promise<PhotoOutcome> {
  try {
    return classifyPhotoResponse((await apiFetch("/api/mobile/account/photo", { method: "DELETE" })).status);
  } catch {
    return "error";
  }
}
