import type { ComponentProps } from "react";
import { Animated } from "react-native";
import { useTheme } from "../use-theme";

export type SurfaceProps = ComponentProps<typeof Animated.View> & { tone?: "background" | "surface" };

/** Contenedor con fondo del tema; animable (los estilos pueden llevar `Animated.Value`). */
export function Surface({ tone = "surface", style, ...rest }: SurfaceProps) {
  const { colors } = useTheme();
  return <Animated.View {...rest} style={[{ backgroundColor: colors[tone] }, style]} />;
}
