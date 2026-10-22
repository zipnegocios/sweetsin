import { Text as RNText } from "react-native";
import type { TypeVariant } from "../themes";
import { useTheme } from "../use-theme";

/**
 * Glifo de estado Unicode, decorativo (el texto que lo acompaña es el portador del significado).
 * Sin `fontFamily`: Atkinson no cubre estos símbolos y se usa la fuente de símbolos del sistema.
 */
export function Glyph({ char, color, variant = "label" }: { char: string; color: string; variant?: TypeVariant }) {
  const { fontSize, lineHeight } = useTheme().type[variant];
  return (
    <RNText accessible={false} importantForAccessibility="no" style={{ color, fontSize, lineHeight }}>
      {char}
    </RNText>
  );
}
