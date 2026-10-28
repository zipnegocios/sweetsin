import { Glyph } from "../atoms/Glyph";
import { Text } from "../atoms/Text";
import { Touchable } from "../atoms/Touchable";
import { useTheme } from "../use-theme";

/** Fila de elección única (radio): el estado lo portan el glifo ●/○ y el lector de pantalla, no solo el color. */
export function OptionRow({
  label,
  flag,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  /** Bandera (emoji) opcional antes del texto; el lector de pantalla sigue leyendo solo `label`. */
  flag?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const t = theme.components.option;
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      android_ripple={{ color: t.bgPressed }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: t.gap,
        paddingHorizontal: t.paddingH,
        borderRadius: t.radius,
        borderWidth: selected ? t.borderWidthSelected : t.borderWidth,
        borderColor: selected ? t.borderSelected : t.border,
        backgroundColor: t.bg,
      }}
    >
      <Glyph char={selected ? t.glyphOn : t.glyphOff} color={theme.colors.textPrimary} variant="bodyStrong" />
      {flag ? <Glyph char={flag} color={theme.colors.textPrimary} variant="title" /> : null}
      <Text variant={selected ? "bodyStrong" : "body"} style={{ flex: 1 }}>
        {label}
      </Text>
    </Touchable>
  );
}
