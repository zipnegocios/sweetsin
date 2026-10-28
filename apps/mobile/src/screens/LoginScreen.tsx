import { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, type TextInput } from "react-native";
import { apiFetch } from "../api/client";
import { saveRole, saveToken } from "../auth/session";
import { canSubmitLogin, classifyLoginFailure, normalizeLoginEmail, type LoginError } from "../auth/login-rules";
import {
  disableBiometric,
  enableBiometric,
  isBiometricEnabled,
  isBiometricSupported,
  markBiometricOfferDeclined,
  readBiometricCredentials,
  wasBiometricOfferDeclined,
} from "../auth/biometric";
import { BrandMark, Button, ScreenLayout, Spacer, Surface, Text, TextField, useTheme } from "../design-system";
import { strings } from "../i18n";

type StaffRole = "despachador" | "delivery";
type LoginMessage = LoginError | "biometricInvalidated";

const s = strings.staffApp;
const ERROR_TEXT: Record<LoginMessage, string> = {
  invalid: s.loginInvalid,
  offline: s.loginOffline,
  server: s.loginServerError,
  biometricInvalidated: s.biometricInvalidated,
};
const MARK_SIZE = 160;
const MARK_PLAY_MS = 8000;

/** Pregunta (una sola vez) si quiere entrar con la huella la próxima vez. Resuelve `true` si acepta. */
function askEnableBiometric(): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      s.biometricOfferTitle,
      s.biometricOfferBody,
      [
        { text: s.biometricOfferNo, style: "cancel", onPress: () => resolve(false) },
        { text: s.biometricOfferYes, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (role: StaffRole) => void }) {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<LoginMessage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const pinRef = useRef<TextInput>(null);
  const trimmedEmail = normalizeLoginEmail(email);
  const ready = canSubmitLogin(trimmedEmail, pin);

  useEffect(() => {
    isBiometricEnabled()
      .then((enabled) => setBiometricReady(enabled && isBiometricSupported()))
      .catch(() => setBiometricReady(false));
  }, []);

  /** Llama al login con PIN: devuelve el rol si entró, o el tipo de fallo (quien llama decide qué mostrar). */
  async function signIn(loginEmail: string, loginPin: string): Promise<{ role: StaffRole } | { error: LoginError }> {
    try {
      const res = await apiFetch("/api/mobile/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, pin: loginPin }),
      });
      if (!res.ok) return { error: classifyLoginFailure({ status: res.status }) };
      const data = (await res.json()) as { token: string; role: StaffRole };
      await saveToken(data.token);
      await saveRole(data.role);
      return { role: data.role };
    } catch (thrown) {
      return { error: classifyLoginFailure({ thrown }) };
    }
  }

  async function handleSubmit() {
    if (!ready || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn(trimmedEmail, pin);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      await offerBiometric(trimmedEmail, pin);
      onLoggedIn(result.role);
    } finally {
      setSubmitting(false);
    }
  }

  /** Tras un login con PIN correcto: ofrece la huella una vez si el teléfono la tiene y aún no está activa. */
  async function offerBiometric(loginEmail: string, loginPin: string) {
    try {
      if (!isBiometricSupported() || (await isBiometricEnabled()) || (await wasBiometricOfferDeclined())) return;
      if (await askEnableBiometric()) await enableBiometric({ email: loginEmail, pin: loginPin }, s.biometricConfirmPrompt);
      else await markBiometricOfferDeclined();
    } catch {
      // Cancelar la huella o un fallo del Keystore nunca debe impedir entrar: queda el PIN.
    }
  }

  async function handleBiometric() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const read = await readBiometricCredentials(s.biometricLoginPrompt);
      if (read.status === "cancelled") return;
      if (read.status === "invalidated") {
        setBiometricReady(false);
        setError("biometricInvalidated");
        return;
      }
      const { email: savedEmail, pin: savedPin } = read.credentials;
      const result = await signIn(savedEmail, savedPin);
      if ("role" in result) {
        onLoggedIn(result.role);
        return;
      }
      if (result.error === "invalid") {
        // PIN rechazado (lo cambiaron desde el admin o desde otro teléfono): las credenciales guardadas ya no sirven.
        await disableBiometric();
        setBiometricReady(false);
        setError("biometricInvalidated");
      } else {
        setError(result.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScreenLayout
        bottomBar={
          <>
            <Button label={s.loginButton} onPress={handleSubmit} loading={submitting} disabled={!ready && !submitting} />
            {biometricReady ? (
              <Button label={s.biometricLoginButton} variant="secondary" onPress={handleBiometric} disabled={submitting} />
            ) : null}
          </>
        }
      >
        <Surface tone="background" style={{ alignItems: "center" }}>
          <BrandMark variant="videologo" size={MARK_SIZE} playOnceMs={MARK_PLAY_MS} />
          <Text variant="brand">Sweet Sin</Text>
        </Surface>
        <Spacer size="lg" />
        <TextField
          label={s.loginEmailLabel}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => pinRef.current?.focus()}
        />
        <TextField
          label={s.loginPinLabel}
          inputRef={pinRef}
          value={pin}
          onChangeText={setPin}
          inputMode="numeric"
          secureTextEntry
          maxLength={6}
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
        {error && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" color={theme.colors.danger}>
            {ERROR_TEXT[error]}
          </Text>
        )}
      </ScreenLayout>
    </KeyboardAvoidingView>
  );
}
