import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/context";
import { useProfile } from "../auth/use-profile";
import { Banner, Button, ScreenHeader, ScreenLayout, StaffIdCard } from "../design-system";
import { strings } from "../i18n";
import type { StaffRole } from "../auth/startup";

const s = strings.staffApp;

/** Credencial del staff: foto, nombre, rol y código. Pensada para mostrarla en una entrega o en la puerta del local. */
export function CredentialScreen({ role }: { role: StaffRole }) {
  const navigation = useNavigation();
  const { logout } = useAuth();
  const { status, profile } = useProfile();

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
    </ScreenLayout>
  );
}
