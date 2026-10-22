import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { rejectAfter } from "../hooks/with-timeout";
import { EVIDENCE_LOCATION_TIMEOUT_MS } from "./limits";

export type CaptureResult =
  | { ok: true; fileUri: string; capturedAt: string; lat: number; lng: number }
  | { ok: false; reason: "camera-denied" | "location-denied" | "cancelled" | "location-unavailable" };

/** Foto + GPS. Los permisos se piden recién acá (al tocar el botón), nunca al abrir la app. */
export async function captureEvidence(): Promise<CaptureResult> {
  const camera = await ImagePicker.requestCameraPermissionsAsync();
  if (!camera.granted) return { ok: false, reason: "camera-denied" };
  const photo = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 });
  if (photo.canceled || !photo.assets[0]) return { ok: false, reason: "cancelled" };

  const loc = await Location.requestForegroundPermissionsAsync();
  if (!loc.granted) return { ok: false, reason: "location-denied" };
  try {
    // Sin fix (p. ej. en interiores) la llamada puede no asentarse nunca: plazo y, si vence, última posición conocida.
    const pos = await rejectAfter(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      EVIDENCE_LOCATION_TIMEOUT_MS,
    ).catch(() => Location.getLastKnownPositionAsync());
    if (!pos) return { ok: false, reason: "location-unavailable" };
    return {
      ok: true,
      fileUri: photo.assets[0].uri,
      capturedAt: new Date(pos.timestamp).toISOString(),
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    };
  } catch {
    return { ok: false, reason: "location-unavailable" };
  }
}
