import { setOptions } from "@googlemaps/js-api-loader";

let optionsSet = false;

export function ensureGoogleMapsOptionsSet(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return false;
  if (!optionsSet) {
    setOptions({ key: apiKey, v: "weekly" });
    optionsSet = true;
  }
  return true;
}
