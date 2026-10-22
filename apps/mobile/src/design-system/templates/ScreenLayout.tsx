import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../use-theme";

export type ScreenLayoutProps = {
  header?: ReactNode;
  banner?: ReactNode;
  /** Acciones primarias: fijas en la zona del pulgar (tercio inferior). */
  bottomBar?: ReactNode;
  /**
   * `true` (por defecto): el contenido va en un `ScrollView` con padding y separación del tema.
   * `false`: el contenido va en un `View` con `flex: 1`, sin padding ni separación, para que una
   * `FlatList` (con su `RefreshControl`) haga su propio scroll y su `contentContainerStyle`.
   */
  scroll?: boolean;
  children: ReactNode;
};

/** Área segura, cabecera, banner, contenido (desplazable o no) y barra de acción inferior. */
export function ScreenLayout({ header, banner, bottomBar, scroll = true, children }: ScreenLayoutProps) {
  const t = useTheme().components.layout;
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={header ? "light" : "dark"} />
      <View style={{ paddingTop: insets.top, backgroundColor: header ? t.headerBg : t.bg }}>{header}</View>
      {banner}
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, gap: t.gap, paddingHorizontal: t.paddingH, paddingVertical: t.paddingV }}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
      {bottomBar ? (
        <View
          style={{
            gap: t.barGap,
            paddingHorizontal: t.paddingH,
            paddingTop: t.barPadding,
            paddingBottom: insets.bottom + t.barPadding,
            borderTopWidth: 1,
            borderTopColor: t.barBorder,
            backgroundColor: t.bg,
          }}
        >
          {bottomBar}
        </View>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}
    </View>
  );
}
