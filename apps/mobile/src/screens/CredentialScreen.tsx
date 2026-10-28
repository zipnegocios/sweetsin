import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { changeLocale } from "../auth/locale";
import type { PhotoOutcome } from "../auth/photo-rules";
import { removeProfilePhoto, takeProfilePhoto, uploadProfilePhoto } from "../auth/profile-photo";
import { useAuth } from "../auth/context";
import { useProfile } from "../auth/use-profile";
import { Banner, Button, Card, OptionRow, ScreenHeader, ScreenLayout, StaffIdCard, Text, useTheme } from "../design-system";
import { locale, strings } from "../i18n";
import type { StaffRole } from "../auth/startup";

type Notice = { kind: "ok" | "error"; text: string } | null;

/** Credencial del staff: foto, nombre, rol y código. Pensada para mostrarla en una entrega o en la puerta del local. */
export function CredentialScreen({ role }: { role: StaffRole }) {
  const s = strings.staffApp;
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { logout } = useAuth();
  const { status, profile, reload } = useProfile();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const photoOutcome = (outcome: PhotoOutcome): Notice => {
    if (outcome === "ok") return { kind: "ok", text: s.photoSaved };
    return { kind: "error", text: outcome === "tooLarge" ? s.photoTooLarge : s.photoError };
  };

  async function changePhoto(camera: "front" | "back") {
    setBusy(true);
    setNotice(null);
    try {
      const shot = await takeProfilePhoto(camera);
      if (!shot.ok) {
        if (shot.reason === "camera-denied") setNotice({ kind: "error", text: s.photoCameraDenied });
        return;
      }
      const outcome = await uploadProfilePhoto(shot.uri);
      setNotice(photoOutcome(outcome));
      if (outcome === "ok") reload();
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto() {
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await removeProfilePhoto();
      setNotice(photoOutcome(outcome));
      if (outcome === "ok") reload();
    } finally {
      setBusy(false);
    }
  }

  async function pickLanguage(next: "en" | "es") {
    if (next === locale) return;
    // Cambia al instante (la navegación se remonta); si no se pudo guardar en la cuenta, el aviso se ve en la próxima apertura.
    await changeLocale(next);
  }

  return (
    <ScreenLayout
      header={<ScreenHeader title={s.credentialTitle} />}
      banner={status === "error" ? <Banner glyph="⊘" message={s.credentialLoadError} /> : undefined}
      bottomBar={
        <>
          <Button label={s.securityOpen} variant="secondary" onPress={() => navigation.navigate("Seguridad" as never)} />
          <Button label={s.credentialLogout} variant="secondary" onPress={() => void logout()} />
        </>
      }
    >
      {profile ? (
        <StaffIdCard
          brandLabel="Sweet Sin"
          name={profile.name}
          roleLabel={role === "delivery" ? s.credentialRoleDelivery : s.credentialRoleDispatcher}
          codeLabel={s.credentialCodeLabel}
          code={profile.code}
          photoUrl={profile.photoUrl}
          onClose={() => navigation.goBack()}
          closeLabel={s.credentialCloseCard}
        />
      ) : null}
      <Card>
        <Text variant="heading">{s.photoSectionTitle}</Text>
        <Button label={s.photoFront} variant="secondary" onPress={() => void changePhoto("front")} disabled={busy} />
        <Button label={s.photoRear} variant="secondary" onPress={() => void changePhoto("back")} disabled={busy} />
        {profile?.photoUrl ? <Button label={s.photoRemove} variant="secondary" onPress={() => void deletePhoto()} disabled={busy} /> : null}
        {notice ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" color={notice.kind === "ok" ? colors.success : colors.danger}>
            {notice.text}
          </Text>
        ) : null}
      </Card>
      <Card>
        <Text variant="heading">{s.languageSectionTitle}</Text>
        <OptionRow label={s.languageOptionEn} selected={locale === "en"} onPress={() => void pickLanguage("en")} />
        <OptionRow label={s.languageOptionEs} selected={locale === "es"} onPress={() => void pickLanguage("es")} />
      </Card>
    </ScreenLayout>
  );
}
