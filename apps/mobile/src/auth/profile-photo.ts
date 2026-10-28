import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { apiFetch } from "../api/client";
import { centerSquare, classifyPhotoResponse, PROFILE_PHOTO_SIDE, type PhotoOutcome } from "./photo-rules";

/** Foto existente de la galería, cuadrada. El selector del sistema no pide permiso en Android. */
export async function pickProfilePhotoFromGallery(): Promise<{ uri: string } | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
  return picked.canceled || !picked.assets[0] ? null : { uri: picked.assets[0].uri };
}

/** Recorta el cuadrado central y reduce a 600 px JPEG (igual que la web): pesa unas decenas de KB y cabe de sobra en el tope del servidor. */
export async function prepareProfilePhoto(uri: string): Promise<string> {
  const base = await ImageManipulator.manipulate(uri).renderAsync(); // dimensiones ya con la orientación aplicada
  const context = ImageManipulator.manipulate(uri).crop(centerSquare(base.width, base.height)).resize({ width: PROFILE_PHOTO_SIDE });
  const out = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return out.uri;
}

export async function uploadProfilePhoto(uri: string): Promise<PhotoOutcome> {
  try {
    const form = new FormData();
    form.append("file", { uri, name: "photo.jpg", type: "image/jpeg" } as unknown as Blob); // forma propia de React Native
    return classifyPhotoResponse((await apiFetch("/api/mobile/account/photo", { method: "POST", body: form })).status);
  } catch {
    return "error";
  }
}

export async function removeProfilePhoto(): Promise<PhotoOutcome> {
  try {
    return classifyPhotoResponse((await apiFetch("/api/mobile/account/photo", { method: "DELETE" })).status);
  } catch {
    return "error";
  }
}
