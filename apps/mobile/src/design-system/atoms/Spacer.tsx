import { View } from "react-native";
import type { SpaceKey } from "../tokens/space";
import { useTheme } from "../use-theme";

export function Spacer({ size, horizontal = false }: { size: SpaceKey; horizontal?: boolean }) {
  const value = useTheme().components.space[size];
  return <View style={horizontal ? { width: value } : { height: value }} />;
}
