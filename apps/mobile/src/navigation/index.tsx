import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/LoginScreen";
import { DespachadorQueueScreen } from "../screens/DespachadorQueueScreen";
import { DeliveryQueueScreen } from "../screens/DeliveryQueueScreen";
import { getToken, clearToken } from "../auth/session";
import { apiFetch } from "../api/client";

const Stack = createNativeStackNavigator();

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
