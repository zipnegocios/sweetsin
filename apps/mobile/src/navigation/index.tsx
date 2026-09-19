import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/LoginScreen";
import { DespachadorQueueScreen } from "../screens/DespachadorQueueScreen";
import { DeliveryQueueScreen } from "../screens/DeliveryQueueScreen";
import { getToken, clearToken } from "../auth/session";
import { apiFetch } from "../api/client";

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
  const [role, setRole] = useState<"despachador" | "delivery" | null | "loading">("loading");

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return setRole(null);
      const res = await apiFetch("/api/mobile/auth/me");
      if (!res.ok) {
        await clearToken();
        return setRole(null);
      }
      const data = (await res.json()) as { role: "despachador" | "delivery" };
      setRole(data.role);
    })();
  }, []);

  useEffect(() => {
    if (role === "despachador" || role === "delivery") {
      void registerPushToken();
    }
  }, [role]);

  if (role === "loading") return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {role === null && <Stack.Screen name="Login" options={{ headerShown: false }}>{() => <LoginScreen onLoggedIn={setRole} />}</Stack.Screen>}
        {role === "despachador" && <Stack.Screen name="Cola" component={DespachadorQueueScreen} />}
        {role === "delivery" && <Stack.Screen name="Entregas" component={DeliveryQueueScreen} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
