import type { ConfigContext, ExpoConfig } from "expo/config";

// Dorado de la paleta: distingue el icono de desarrollo del de produccion.
const DEV_ICON_BACKGROUND = "#B8872B";

export default ({ config }: ConfigContext): ExpoConfig => {
  const development = process.env.APP_VARIANT === "development";
  // Clave publica restringida por paquete y SHA-1; sin ella el build sigue (el mapa no cargara).
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  if (!development && !mapsKey) return config as ExpoConfig;

  const android = { ...config.android };
  if (development) {
    android.package = "au.com.sweetsin.staff.dev";
    android.adaptiveIcon = { ...config.android?.adaptiveIcon, backgroundColor: DEV_ICON_BACKGROUND };
  }
  if (mapsKey) android.config = { ...config.android?.config, googleMaps: { apiKey: mapsKey } };
  return { ...config, ...(development ? { name: "Sweet Sin Staff (Dev)" } : {}), android } as ExpoConfig;
};
