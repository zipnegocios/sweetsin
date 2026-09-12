import { setOptions } from '@googlemaps/js-api-loader';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// setOptions must be called at most once, and before any library loads —
// shared here so LocationMap and CheckoutModal (which load libraries
// independently, in whichever order the user triggers them) don't race to
// call it twice.
let optionsSet = false;

export function ensureGoogleMapsOptionsSet(): boolean {
  if (!API_KEY) return false;
  if (!optionsSet) {
    setOptions({ key: API_KEY, v: 'weekly' });
    optionsSet = true;
  }
  return true;
}
