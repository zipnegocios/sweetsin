import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../use-theme";

export type TouchableProps = Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> };

/** Base de todo lo tocable: garantiza `touch.min` de alto y ancho. */
export function Touchable({ style, ...rest }: TouchableProps) {
  const { touch } = useTheme();
  return <Pressable {...rest} style={[{ minHeight: touch.min, minWidth: touch.min }, style]} />;
}
