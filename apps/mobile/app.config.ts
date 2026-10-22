import type { ConfigContext, ExpoConfig } from "expo/config";

// Dorado de la paleta: distingue el icono de desarrollo del de produccion.
const DEV_ICON_BACKGROUND = "#B8872B";

export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.APP_VARIANT !== "development") return config as ExpoConfig;
  return {
    ...config,
    name: "Sweet Sin Staff (Dev)",
    android: {
      ...config.android,
      package: "au.com.sweetsin.staff.dev",
      adaptiveIcon: { ...config.android?.adaptiveIcon, backgroundColor: DEV_ICON_BACKGROUND },
    },
  } as ExpoConfig;
};
