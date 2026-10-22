import { View } from "react-native";
import { Spacer } from "../atoms/Spacer";
import { Text } from "../atoms/Text";
import { BrandMark } from "../molecules/BrandMark";
import { useTheme } from "../use-theme";

/** Pantalla vacía: momento de marca (isotipo animado, voz ligera en el copy que llega por props). */
export function EmptyState({ title, message }: { title: string; message: string }) {
  const t = useTheme().components.emptyState;
  const textStyle = { textAlign: "center" as const, maxWidth: t.maxTextWidth };
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: t.padding }}
    >
      <BrandMark variant="isotipo" size={t.markSize} />
      <Spacer size="lg" />
      <Text variant="heading" color={t.title} style={textStyle}>
        {title}
      </Text>
      <Spacer size="sm" />
      <Text variant="quiet" color={t.message} style={textStyle}>
        {message}
      </Text>
    </View>
  );
}
