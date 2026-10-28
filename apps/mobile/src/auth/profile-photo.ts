import * as ImagePicker from "expo-image-picker";
import { apiFetch } from "../api/client";

import { classifyPhotoResponse, type PhotoOutcome } from "./photo-rules";

export type TakePhotoResult = { ok: true; uri: string } | { ok: false; reason: "camera-denied" | "cancelled" };

/** Foto cuadrada con la cámara elegida. El permiso se pide recién al tocar el botón. Calidad baja: el servidor topa en 2 MB. */
export async function takeProfilePhoto(camera: "front" | "back"): Promise<TakePhotoResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { ok: false, reason: "camera-denied" };
  const shot = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    cameraType: camera === "front" ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.4,
  });
  if (shot.canceled || !shot.assets[0]) return { ok: false, reason: "cancelled" };
  return { ok: true, uri: shot.assets[0].uri };
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
