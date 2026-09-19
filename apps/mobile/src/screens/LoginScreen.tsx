import { useState } from "react";
import { View, TextInput, Button, Text } from "react-native";
import { apiFetch } from "../api/client";
import { saveToken } from "../auth/session";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (role: "despachador" | "delivery") => void }) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const res = await apiFetch("/api/mobile/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, pin }),
    });
    if (!res.ok) {
      setError("Email o PIN incorrecto");
      return;
    }
    const data = (await res.json()) as { token: string; role: "despachador" | "delivery" };
    await saveToken(data.token);
    onLoggedIn(data.role);
  }

  return (
    <View>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput placeholder="PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6} secureTextEntry />
      {error && <Text>{error}</Text>}
      <Button title="Entrar" onPress={handleSubmit} />
    </View>
  );
}
