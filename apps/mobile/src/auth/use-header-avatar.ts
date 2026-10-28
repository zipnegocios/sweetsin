import { useNavigation } from "@react-navigation/native";
import type { HeaderAvatar } from "../design-system";
import { strings } from "../i18n";
import { useProfile } from "./use-profile";

/** Avatar de la cabecera que abre la credencial. Sin perfil aún (o sin red) no hay avatar: la cabecera sigue igual que antes. */
export function useHeaderAvatar(): HeaderAvatar | undefined {
  const navigation = useNavigation();
  const { profile } = useProfile();
  if (!profile) return undefined;
  return {
    name: profile.name,
    photoUrl: profile.photoUrl,
    accessibilityLabel: strings.staffApp.credentialOpen,
    onPress: () => navigation.navigate("Credencial" as never),
  };
}
