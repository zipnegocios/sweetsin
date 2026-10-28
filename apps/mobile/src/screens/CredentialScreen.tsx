import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { Alert } from "react-native";
import { changeLocale } from "../auth/locale";
import type { PhotoOutcome } from "../auth/photo-rules";
import { pickProfilePhotoFromGallery, prepareProfilePhoto, removeProfilePhoto, uploadProfilePhoto } from "../auth/profile-photo";
import { useAuth } from "../auth/context";
import { useProfile } from "../auth/use-profile";
import { Banner, Button, Card, OptionRow, PhotoCapture, ScreenHeader, ScreenLayout, StaffIdCard, Text, useTheme } from "../design-system";
import { locale, strings } from "../i18n";
import type { StaffRole } from "../auth/startup";

type Notice = { kind: "ok" | "error"; text: string } | null;

/** Credencial del staff: foto, nombre, rol y código. Tocar la foto abre su menú (cámara, galería, quitar). */
export function CredentialScreen({ role }: { role: StaffRole }) {
  const s = strings.staffApp;
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { logout } = useAuth();
  const { status, profile, reload } = useProfile();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const noticeFor = (outcome: PhotoOutcome): Notice =>
    outcome === "ok" ? { kind: "ok", text: s.photoSaved } : { kind: "error", text: outcome === "tooLarge" ? s.photoTooLarge : s.photoError };

  /** Reduce la foto, la sube y refresca el perfil. Cualquier fallo del procesamiento se muestra como error de foto. */
  async function save(uri: string) {
    setBusy(true);
    setNotice(null);
    try {
      let prepared: string;
      try {
        prepared = await prepareProfilePhoto(uri);
      } catch (error) {
        setNotice({ kind: "error", text: `${s.photoError} (procesar: ${error instanceof Error ? error.message : String(error)})` });
        return;
      }
      const { outcome, detail } = await uploadProfilePhoto(prepared);
      const next = noticeFor(outcome);
      setNotice(outcome === "error" && next ? { ...next, text: `${next.text} (${detail})` } : next);
      if (outcome === "ok") reload();
    } finally {
      setBusy(false);
    }
  }

  async function pickFromGallery() {
    const picked = await pickProfilePhotoFromGallery().catch(() => null);
    if (picked) await save(picked.uri);
  }

  async function deletePhoto() {
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await removeProfilePhoto();
      setNotice(noticeFor(outcome));
      if (outcome === "ok") reload();
    } finally {
      setBusy(false);
    }
  }

  function openPhotoMenu() {
    if (busy) return;
    Alert.alert(
      s.photoSectionTitle,
      undefined,
      [
        { text: s.photoTake, onPress: () => setCameraOpen(true) },
        { text: s.photoGallery, onPress: () => void pickFromGallery() },
        ...(profile?.photoUrl ? [{ text: s.photoRemove, style: "destructive" as const, onPress: () => void deletePhoto() }] : []),
      ],
      { cancelable: true },
    );
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
          onPhotoPress={openPhotoMenu}
          photoLabel={s.photoChangeLabel}
        />
      ) : null}
      {notice ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" color={notice.kind === "ok" ? colors.success : colors.danger}>
          {notice.text}
        </Text>
      ) : null}
      <Card>
        <Text variant="heading">{s.languageSectionTitle}</Text>
        <OptionRow label={s.languageOptionEs} flag="🇪🇸" selected={locale === "es"} onPress={() => void changeLocale("es")} />
        <OptionRow label={s.languageOptionEn} flag="🇦🇺" selected={locale === "en"} onPress={() => void changeLocale("en")} />
      </Card>
      <PhotoCapture
        visible={cameraOpen}
        labels={{
          title: s.photoSectionTitle,
          guide: s.photoGuide,
          shoot: s.photoShoot,
          flip: s.photoFlip,
          cancel: s.photoCancel,
          grant: s.photoGrant,
          denied: s.photoCameraDenied,
        }}
        onCancel={() => setCameraOpen(false)}
        onCapture={({ uri }) => {
          setCameraOpen(false);
          void save(uri);
        }}
      />
    </ScreenLayout>
  );
}
