import { useRef, useState } from "react";
import { KeyboardAvoidingView, TextInput, type TextInputProps } from "react-native";
import { apiFetch } from "../api/client";
import { saveToken } from "../auth/session";
import { canSubmitLogin, classifyLoginFailure, type LoginError } from "../auth/login-rules";
import { BrandMark, Button, ScreenLayout, Spacer, Surface, Text, useTheme } from "../design-system";
import { strings } from "../i18n";

const s = strings.staffApp;
const ERROR_TEXT: Record<LoginError, string> = {
  invalid: s.loginInvalid,
  offline: s.loginOffline,
  server: s.loginServerError,
};
const MARK_SIZE = 160;
const MARK_PLAY_MS = 8000;

type FieldProps = Pick<
  TextInputProps,
  "value" | "onChangeText" | "keyboardType" | "inputMode" | "autoCapitalize" | "autoComplete" | "secureTextEntry" | "maxLength" | "returnKeyType" | "onSubmitEditing"
> & { label: string; inputRef?: React.RefObject<TextInput | null> };

/** Campo con etiqueta visible encima; el borde engrosa y oscurece al enfocar. */
function Field({ label, inputRef, ...input }: FieldProps) {
  const theme = useTheme();
  const t = theme.components.field;
  const [focused, setFocused] = useState(false);
  return (
    <Surface tone="background" style={{ gap: t.labelGap }}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={inputRef}
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={t.placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...theme.type.body,
          color: theme.colors.textPrimary,
          backgroundColor: t.bg,
          minHeight: t.minHeight,
          paddingHorizontal: t.paddingH,
          borderRadius: t.radius,
          borderWidth: focused ? t.borderWidthFocus : t.borderWidth,
          borderColor: focused ? t.borderFocus : t.border,
        }}
      />
    </Surface>
  );
}

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (role: "despachador" | "delivery") => void }) {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<LoginError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pinRef = useRef<TextInput>(null);
  const ready = canSubmitLogin(email, pin);

  async function handleSubmit() {
    if (!ready || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/mobile/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, pin }),
      });
      if (!res.ok) {
        setError(classifyLoginFailure({ status: res.status }));
        return;
      }
      const data = (await res.json()) as { token: string; role: "despachador" | "delivery" };
      await saveToken(data.token);
      onLoggedIn(data.role);
    } catch (thrown) {
      setError(classifyLoginFailure({ thrown }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScreenLayout
        bottomBar={<Button label={s.loginButton} onPress={handleSubmit} loading={submitting} disabled={!ready && !submitting} />}
      >
        <Surface tone="background" style={{ alignItems: "center" }}>
          <BrandMark variant="videologo" size={MARK_SIZE} playOnceMs={MARK_PLAY_MS} />
          <Text variant="brand">Sweet Sin</Text>
        </Surface>
        <Spacer size="lg" />
        <Field
          label={s.loginEmailLabel}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => pinRef.current?.focus()}
        />
        <Field
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
          <Text accessibilityRole="alert" color={theme.colors.danger}>
            {ERROR_TEXT[error]}
          </Text>
        )}
      </ScreenLayout>
    </KeyboardAvoidingView>
  );
}
