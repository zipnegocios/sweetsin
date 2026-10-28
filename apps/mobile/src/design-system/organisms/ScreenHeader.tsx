import { View } from "react-native";
import { Text } from "../atoms/Text";
import { Touchable } from "../atoms/Touchable";
import { Avatar } from "../molecules/Avatar";
import { BrandMark } from "../molecules/BrandMark";
import { useTheme } from "../use-theme";

/** Cabecera Tinta: mascota estática decorativa, título y una acción opcional (p. ej. "Salir"). */
export type HeaderAvatar = { name: string; photoUrl: string | null; onPress: () => void; accessibilityLabel: string };

export function ScreenHeader({
  title,
  actionLabel,
  onAction,
  avatar,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Foto del staff: abre su credencial. */
  avatar?: HeaderAvatar;
}) {
  const t = useTheme().components.header;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: t.gap,
        minHeight: t.minHeight,
        paddingHorizontal: t.paddingH,
        paddingVertical: t.paddingV,
        backgroundColor: t.bg,
      }}
    >
      <BrandMark variant="isotipo" size={t.mascotSize} animated={false} />
      <Text variant="title" color={t.fg} accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Text>
      {avatar ? (
        <Touchable onPress={avatar.onPress} accessibilityRole="button" accessibilityLabel={avatar.accessibilityLabel}>
          <Avatar name={avatar.name} photoUrl={avatar.photoUrl} size="header" />
        </Touchable>
      ) : null}
      {actionLabel && onAction ? (
        <Touchable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={{ justifyContent: "center", alignItems: "center", paddingHorizontal: t.actionPaddingH }}
        >
          {({ pressed }) => (
            <Text
              variant="button"
              color={t.fg}
              style={{ textDecorationLine: "underline", opacity: pressed ? t.actionPressedOpacity : 1 }}
            >
              {actionLabel}
            </Text>
          )}
        </Touchable>
      ) : null}
    </View>
  );
}
