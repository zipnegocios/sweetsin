// Subrutas por peso: importar la raíz del paquete empaquetaría también las dos itálicas.
import { AtkinsonHyperlegible_400Regular } from "@expo-google-fonts/atkinson-hyperlegible/400Regular";
import { AtkinsonHyperlegible_700Bold } from "@expo-google-fonts/atkinson-hyperlegible/700Bold";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, outdoor } from "./src/design-system";
import { RootNavigator } from "./src/navigation";

// Se llama en el ámbito del módulo (no en un efecto) para que el splash no se oculte antes.
SplashScreen.preventAutoHideAsync();

export default function App() {
  // Las claves son los nombres de familia que el tema usa: un solo origen para ambos.
  const [loaded, error] = useFonts({
    [outdoor.type.body.fontFamily]: AtkinsonHyperlegible_400Regular,
    [outdoor.type.bodyStrong.fontFamily]: AtkinsonHyperlegible_700Bold,
  });

  useEffect(() => {
    // Si la carga falla, la app abre igual con la fuente del sistema: el splash nunca queda colgado.
    if (loaded || error) SplashScreen.hide();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider theme={outdoor}>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
