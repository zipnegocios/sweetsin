import { useNavigation } from "@react-navigation/native";
import { useProfile } from "../auth/use-profile";
import { Banner, Button, ScreenHeader, ScreenLayout, StaffIdCard } from "../design-system";
import { strings } from "../i18n";
import type { StaffRole } from "../auth/startup";

const s = strings.staffApp;

/** Credencial del staff: foto, nombre, rol y código. Pensada para mostrarla en una entrega o en la puerta del local. */
export function CredentialScreen({ role }: { role: StaffRole }) {
  const navigation = useNavigation();
  const { status, profile } = useProfile();

  return (
    <ScreenLayout
      header={<ScreenHeader title={s.credentialTitle} />}
      banner={status === "error" ? <Banner glyph="⊘" message={s.credentialLoadError} /> : undefined}
      bottomBar={<Button label={s.credentialClose} variant="secondary" onPress={() => navigation.goBack()} />}
    >
      {profile ? (
        <StaffIdCard
          brandLabel="Sweet Sin"
          name={profile.name}
          roleLabel={role === "delivery" ? s.credentialRoleDelivery : s.credentialRoleDispatcher}
          codeLabel={s.credentialCodeLabel}
          code={profile.code}
          photoUrl={profile.photoUrl}
        />
      ) : null}
    </ScreenLayout>
  );
}
