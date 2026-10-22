import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing } from "react-native";
import { Surface } from "../atoms/Surface";
import { useReduceMotion } from "../use-reduce-motion";
import { useTheme } from "../use-theme";

/** Tarjeta de una orden. Con `index` entra escalonada en el primer montaje (salvo reducir movimiento). */
export function Card({ index, children }: { index?: number; children: ReactNode }) {
  const theme = useTheme();
  const t = theme.components.card;
  const reduceMotion = useReduceMotion();
  const animate = index !== undefined && !reduceMotion;
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const started = useRef(false);

  useEffect(() => {
    if (!animate) {
      progress.stopAnimation();
      progress.setValue(1);
      return;
    }
    if (started.current) return;
    started.current = true;
    Animated.timing(progress, {
      toValue: 1,
      duration: theme.motion.enterMs,
      delay: Math.min(index ?? 0, t.staggerCap) * theme.motion.staggerMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animate]);

  return (
    <Surface
      tone="surface"
      accessible={false}
      style={{
        borderRadius: t.radius,
        borderWidth: t.borderWidth,
        borderColor: t.border,
        padding: t.padding,
        gap: t.gap,
        alignItems: "stretch",
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [t.enterOffset, 0] }) }],
      }}
    >
      {children}
    </Surface>
  );
}
