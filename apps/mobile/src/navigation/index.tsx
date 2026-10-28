import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { NavigationContainer, type InitialState } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/LoginScreen";
import { DespachadorQueueScreen } from "../screens/DespachadorQueueScreen";
import { DeliveryQueueScreen } from "../screens/DeliveryQueueScreen";
import { CredentialScreen } from "../screens/CredentialScreen";
import { SecurityScreen } from "../screens/SecurityScreen";
import { clearSession, getCachedRole, getSavedLocale, getToken, saveRole } from "../auth/session";
import { AuthContext } from "../auth/context";
import { resolveStartupSession, type StaffRole } from "../auth/startup";
import { apiFetch } from "../api/client";
import { clearAssigned } from "../offline/assigned-cache";
import { withTimeout } from "../hooks/with-timeout";
import { endShift } from "../tracking/shift";
import { locale, setLocale, subscribeLocale } from "../i18n";
import { indoor, outdoor, ThemeProvider } from "../design-system";

const Stack = createNativeStackNavigator();

async function registerPushToken(): Promise<void> {
  try {
    // Expo Go (SDK 53+) eliminó el soporte de push remotas — el modulo
    // expo-notifications dispara un error de runtime apenas se importa
    // bajo Expo Go, no solo al invocarlo. Import dinamico + chequeo de
    // appOwnership para no crashear toda la navegacion en ese entorno;
    // en un development build/standalone (appOwnership !== "expo") esto
    // no aplica y el registro real corre normal.
    const Constants = (await import("expo-constants")).default;
    if (Constants.appOwnership === "expo") return;

    const Notifications = await import("expo-notifications");
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await apiFetch("/api/mobile/push-token", {
      method: "POST",
      body: JSON.stringify({ token: tokenData.data }),
    });
  } catch {
    // Un fallo al registrar el push token (permiso denegado, error de red)
    // nunca debe romper la navegacion — la notificacion simplemente queda
    // "blocked" del lado del servidor.
  }
}

export function RootNavigator() {
  const [role, setRole] = useState<StaffRole | null | "loading">("loading");
  // Cambiar de idioma remonta la navegación (los textos se leen al renderizar); se conserva en qué pantalla estaba.
  const currentLocale = useSyncExternalStore(subscribeLocale, () => locale);
  const navState = useRef<InitialState | undefined>(undefined);

  // Único cierre de sesión (credencial o 401). Corta el seguimiento del turno antes de borrar el token; no toca la cola de entregas.
  const logout = useCallback(async () => {
    await withTimeout(endShift(), 8000).catch(() => undefined);
    navState.current = undefined; // la próxima sesión arranca en su pantalla inicial
    await Promise.allSettled([clearAssigned(), clearSession()]);
    setRole(null);
  }, []);

  useEffect(() => {
    getSavedLocale()
      .then((saved) => saved && setLocale(saved))
      .catch(() => {}); // sin idioma guardado se queda el del teléfono
    resolveStartupSession({ getToken, getCachedRole, saveRole, fetchMe: () => apiFetch("/api/mobile/auth/me") })
      .then(({ role: next, invalid }) => (invalid ? logout() : setRole(next)))
      .catch(() => setRole(null)); // nunca queda en blanco; el token se conserva
  }, [logout]);

  useEffect(() => {
    if (role === "despachador" || role === "delivery") {
      void registerPushToken();
    }
  }, [role]);

  if (role === "loading") return null;

  return (
    <AuthContext.Provider value={{ logout }}>
      <NavigationContainer key={currentLocale} initialState={navState.current} onStateChange={(state) => (navState.current = state)}>
        <Stack.Navigator>
          {role === null && <Stack.Screen name="Login" options={{ headerShown: false }}>{() => <LoginScreen onLoggedIn={setRole} />}</Stack.Screen>}
          {role === "despachador" && (
            <Stack.Screen name="Cola" options={{ headerShown: false }}>
              {() => (
                <ThemeProvider theme={indoor}>
                  <DespachadorQueueScreen />
                </ThemeProvider>
              )}
            </Stack.Screen>
          )}
          {role === "delivery" && <Stack.Screen name="Entregas" component={DeliveryQueueScreen} options={{ headerShown: false }} />}
          {(role === "despachador" || role === "delivery") && (
            <Stack.Screen name="Credencial" options={{ headerShown: false, presentation: "modal" }}>
              {() => (
                <ThemeProvider theme={role === "delivery" ? outdoor : indoor}>
                  <CredentialScreen role={role} />
                </ThemeProvider>
              )}
            </Stack.Screen>
          )}
          {(role === "despachador" || role === "delivery") && (
            <Stack.Screen name="Seguridad" options={{ headerShown: false }}>
              {() => (
                <ThemeProvider theme={role === "delivery" ? outdoor : indoor}>
                  <SecurityScreen />
                </ThemeProvider>
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
