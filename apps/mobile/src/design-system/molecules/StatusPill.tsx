import { View } from "react-native";
import { Glyph } from "../atoms/Glyph";
import { Spacer } from "../atoms/Spacer";
import { Text } from "../atoms/Text";
import type { OrderStatus } from "../themes";
import { useTheme } from "../use-theme";

/** Estado de una orden o de su sincronización: siempre glifo + texto; el color solo refuerza. */
export function StatusPill({ status, label }: { status: OrderStatus; label: string }) {
  const t = useTheme().components.pill;
  const look = t.status[status];
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        minHeight: t.minHeight,
        borderRadius: t.radius,
        paddingVertical: t.paddingV,
        paddingHorizontal: t.paddingH,
        backgroundColor: look.bg,
        borderColor: look.border ?? undefined,
        borderWidth: look.borderWidth,
      }}
    >
      <Glyph char={look.glyph} color={look.fg} />
      <Spacer size="xs" horizontal />
      <Text variant="label" color={look.fg}>
        {label}
      </Text>
    </View>
  );
}
