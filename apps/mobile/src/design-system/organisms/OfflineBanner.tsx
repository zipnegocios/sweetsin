import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { Banner } from "../molecules/Banner";
import { useReduceMotion } from "../use-reduce-motion";
import { useTheme } from "../use-theme";

/** Aviso persistente de "sin conexión" debajo de la cabecera; no se descarta a mano. */
export function OfflineBanner({ visible, message }: { visible: boolean; message: string }) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [rendered, setRendered] = useState(visible);
  const [height, setHeight] = useState(theme.components.banner.minHeight);
  const hidden = useRef(new Animated.Value(1)).current; // 1 = oculto arriba, 0 = en su lugar

  useEffect(() => {
    if (visible) setRendered(true);
    if (reduceMotion) {
      hidden.setValue(visible ? 0 : 1);
      if (!visible) setRendered(false);
      return;
    }
    Animated.timing(hidden, {
      toValue: visible ? 0 : 1,
      duration: visible ? theme.motion.enterMs : theme.motion.bannerMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setRendered(false);
    });
  }, [visible, reduceMotion]);

  if (!rendered) return null;

  return (
    <View style={{ overflow: "hidden" }}>
      <Animated.View
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        style={{ transform: [{ translateY: hidden.interpolate({ inputRange: [0, 1], outputRange: [0, -height] }) }] }}
      >
        <Banner glyph={theme.components.offlineBanner.glyph} message={message} />
      </Animated.View>
    </View>
  );
}
