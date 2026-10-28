// API pública del design system: las pantallas importan solo de acá.
export { ThemeProvider } from "./ThemeProvider";
export { useTheme } from "./use-theme";
export { useReduceMotion } from "./use-reduce-motion";
export { brand, indoor, outdoor } from "./themes";
export type { ButtonVariant, OrderStatus, SemanticColor, TextSpec, Theme, TypeVariant } from "./themes";

export { Glyph } from "./atoms/Glyph";
export { Spacer } from "./atoms/Spacer";
export { Surface } from "./atoms/Surface";
export { Text } from "./atoms/Text";
export { Touchable } from "./atoms/Touchable";

export { Banner } from "./molecules/Banner";
export { BrandMark } from "./molecules/BrandMark";
export { Button } from "./molecules/Button";
export { Avatar } from "./molecules/Avatar";
export { Card } from "./molecules/Card";
export { OptionRow } from "./molecules/OptionRow";
export { TextField } from "./molecules/TextField";
export { StatusPill } from "./molecules/StatusPill";

export { EmptyState } from "./organisms/EmptyState";
export { OfflineBanner } from "./organisms/OfflineBanner";
export { ScreenHeader } from "./organisms/ScreenHeader";
export type { HeaderAvatar } from "./organisms/ScreenHeader";
export { StaffIdCard } from "./organisms/StaffIdCard";

export { ScreenLayout } from "./templates/ScreenLayout";
