import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { isNetworkError } from "../api/network";
import {
  classifyAccountResponse,
  validatePasswordChange,
  validatePinChange,
  type AccountOutcome,
} from "../auth/account-rules";
import { disableBiometric, enableBiometric, isBiometricEnabled, isBiometricSupported } from "../auth/biometric";
import { useAuth } from "../auth/context";
import { Button, Card, ScreenHeader, ScreenLayout, Text, TextField, useTheme } from "../design-system";
import { strings } from "../i18n";

const s = strings.staffApp;

type Notice = { kind: "ok" | "error"; text: string } | null;

function NoticeText({ notice }: { notice: Notice }) {
  const { colors } = useTheme();
  if (!notice) return null;
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" color={notice.kind === "ok" ? colors.success : colors.danger}>
      {notice.text}
    </Text>
  );
}

/** Llamada autenticada a /api/mobile/account/**. Un 401 es sesión inválida: cierra sesión (contrato de /api/mobile). */
function useAccountCall() {
  const { logout } = useAuth();
  return useCallback(
    async (path: string, method: "PUT" | "POST", body: unknown): Promise<{ outcome: AccountOutcome; json: unknown }> => {
      try {
        const res = await apiFetch(path, { method, body: JSON.stringify(body) });
        if (res.status === 401) {
          await logout();
          return { outcome: "server", json: null };
        }
        const json = await res.json().catch(() => null);
        return { outcome: classifyAccountResponse(res.status, json), json };
      } catch (thrown) {
        return { outcome: isNetworkError(thrown) ? "offline" : "server", json: null };
      }
    },
    [logout],
  );
}

/** Tras cambiar el PIN, la huella guardada quedaría con el PIN viejo: se actualiza, o se desactiva si no se puede. */
async function refreshBiometricAfterPinChange(
  call: ReturnType<typeof useAccountCall>,
  newPin: string,
): Promise<"updated" | "disabled" | "off"> {
  if (!(await isBiometricEnabled())) return "off";
  try {
    const { outcome, json } = await call("/api/mobile/account/verify-pin", "POST", { pin: newPin });
    const email = (json as { email?: unknown } | null)?.email;
    if (outcome !== "ok" || typeof email !== "string") throw new Error("verify failed");
    await enableBiometric({ email, pin: newPin }, s.biometricConfirmPrompt);
    return "updated";
  } catch {
    await disableBiometric();
    return "disabled";
  }
}

function PinSection({ onBiometricChanged }: { onBiometricChanged: () => void }) {
  const call = useAccountCall();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function save() {
    const invalid = validatePinChange(current, next, confirm);
    if (invalid) {
      setNotice({ kind: "error", text: { missing: s.pinCurrentMissing, format: s.pinFormatError, mismatch: s.pinMismatch }[invalid] });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const { outcome } = await call("/api/mobile/account/pin", "PUT", { currentPin: current, newPin: next });
      if (outcome !== "ok") {
        setNotice({ kind: "error", text: outcome === "invalidCurrent" ? s.pinCurrentWrong : outcome === "invalidNew" ? s.pinFormatError : s.accountSaveError });
        return;
      }
      const biometric = await refreshBiometricAfterPinChange(call, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setNotice({ kind: "ok", text: biometric === "disabled" ? `${s.pinChanged} ${s.biometricInvalidated}` : s.pinChanged });
      if (biometric !== "off") onBiometricChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text variant="heading">{s.pinSectionTitle}</Text>
      <TextField label={s.currentPinLabel} value={current} onChangeText={setCurrent} inputMode="numeric" secureTextEntry maxLength={6} />
      <TextField label={s.newPinLabel} value={next} onChangeText={setNext} inputMode="numeric" secureTextEntry maxLength={6} />
      <TextField label={s.confirmPinLabel} value={confirm} onChangeText={setConfirm} inputMode="numeric" secureTextEntry maxLength={6} />
      <NoticeText notice={notice} />
      <Button label={s.savePin} onPress={save} loading={busy} />
    </Card>
  );
}

function PasswordSection() {
  const call = useAccountCall();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function save() {
    const invalid = validatePasswordChange(current, next, confirm);
    if (invalid) {
      setNotice({ kind: "error", text: { missing: s.passwordCurrentMissing, tooShort: s.passwordTooShort, mismatch: s.passwordMismatch }[invalid] });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const { outcome } = await call("/api/mobile/account/password", "PUT", { currentPassword: current, newPassword: next });
      if (outcome !== "ok") {
        setNotice({ kind: "error", text: outcome === "invalidCurrent" ? s.passwordCurrentWrong : outcome === "invalidNew" ? s.passwordTooShort : s.accountSaveError });
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setNotice({ kind: "ok", text: s.passwordChanged });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text variant="heading">{s.passwordSectionTitle}</Text>
      <TextField label={s.currentPasswordLabel} value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
      <TextField label={s.newPasswordLabel} value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
      <TextField label={s.confirmPasswordLabel} value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
      <NoticeText notice={notice} />
      <Button label={s.savePassword} onPress={save} loading={busy} />
    </Card>
  );
}

function BiometricSection({ enabled, onChanged }: { enabled: boolean; onChanged: () => void }) {
  const call = useAccountCall();
  const supported = isBiometricSupported();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  /** Activar y reconfigurar son lo mismo: se confirma el PIN y se vuelven a guardar las credenciales con la huella vigente. */
  async function turnOn() {
    if (!/^\d{6}$/.test(pin)) {
      setNotice({ kind: "error", text: s.pinFormatError });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const { outcome, json } = await call("/api/mobile/account/verify-pin", "POST", { pin });
      const email = (json as { email?: unknown } | null)?.email;
      if (outcome !== "ok" || typeof email !== "string") {
        setNotice({ kind: "error", text: outcome === "invalidCurrent" ? s.pinCurrentWrong : s.accountSaveError });
        return;
      }
      try {
        await enableBiometric({ email, pin }, s.biometricConfirmPrompt);
      } catch {
        setNotice({ kind: "error", text: s.biometricCancelled });
        return;
      }
      setPin("");
      setNotice({ kind: "ok", text: s.biometricEnabledMsg });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disableBiometric();
      setNotice({ kind: "ok", text: s.biometricDisabledMsg });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text variant="heading">{s.biometricSectionTitle}</Text>
      {supported ? (
        <>
          <Text>{enabled ? s.biometricOn : s.biometricOff}</Text>
          <TextField label={s.biometricPinPrompt} value={pin} onChangeText={setPin} inputMode="numeric" secureTextEntry maxLength={6} />
          <NoticeText notice={notice} />
          <Button label={enabled ? s.biometricReconfigure : s.biometricEnable} onPress={turnOn} loading={busy} />
          {enabled ? <Button label={s.biometricDisable} variant="secondary" onPress={turnOff} disabled={busy} /> : null}
        </>
      ) : (
        <Text>{s.biometricUnsupported}</Text>
      )}
    </Card>
  );
}

/** Seguridad de la cuenta: cambiar PIN y contraseña, y activar, reconfigurar o revocar la huella. */
export function SecurityScreen() {
  const navigation = useNavigation();
  const [biometricOn, setBiometricOn] = useState(false);

  const reloadBiometric = useCallback(() => {
    isBiometricEnabled()
      .then(setBiometricOn)
      .catch(() => setBiometricOn(false));
  }, []);
  useEffect(reloadBiometric, [reloadBiometric]);

  return (
    <ScreenLayout header={<ScreenHeader title={s.securityTitle} actionLabel={s.securityBack} onAction={() => navigation.goBack()} />}>
      <PinSection onBiometricChanged={reloadBiometric} />
      <PasswordSection />
      <BiometricSection enabled={biometricOn} onChanged={reloadBiometric} />
    </ScreenLayout>
  );
}
