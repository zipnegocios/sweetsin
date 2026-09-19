import { useState } from "react";
import { View, TextInput, Button, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
    <SafeAreaView style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="PIN"
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        maxLength={6}
        secureTextEntry
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Entrar" onPress={handleSubmit} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 12, fontSize: 16 },
  error: { color: "red" },
});
