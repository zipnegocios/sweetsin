import { Text as RNText, type StyleProp, type TextProps as RNTextProps, type TextStyle } from "react-native";
import type { TypeVariant } from "../themes";
import { useTheme } from "../use-theme";

export type TextProps = Omit<RNTextProps, "style"> & {
  variant?: TypeVariant;
  /** Un color del tema (`theme.colors.*` o un token de componente). */
  color?: string;
  style?: StyleProp<TextStyle>;
};

/** Texto con la escala del tema; escala con la fuente del sistema (`allowFontScaling` por defecto). */
export function Text({ variant = "body", color, style, ...rest }: TextProps) {
  const { type, colors } = useTheme();
  const spec = type[variant];
  const fallback = variant === "quiet" ? colors.textQuiet : colors.textPrimary;
  return (
    <RNText
      {...rest}
      style={[
        { fontFamily: spec.fontFamily, fontSize: spec.fontSize, lineHeight: spec.lineHeight, color: color ?? fallback },
        style,
      ]}
    />
  );
}
