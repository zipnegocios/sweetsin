import { View } from "react-native";
import { Glyph } from "../atoms/Glyph";
import { Text } from "../atoms/Text";
import { useTheme } from "../use-theme";

/** Franja de aviso a todo el ancho: glifo + mensaje, navy sobre gold (4,91 en outdoor). */
export function Banner({ glyph, message }: { glyph: string; message: string }) {
  const t = useTheme().components.banner;
  return (
    <View
      accessible
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: t.gap,
        minHeight: t.minHeight,
        paddingVertical: t.paddingV,
        paddingHorizontal: t.paddingH,
        backgroundColor: t.bg,
      }}
    >
      <Glyph char={glyph} color={t.fg} variant="bodyStrong" />
      <Text variant="bodyStrong" color={t.fg} style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}
