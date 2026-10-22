import { useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing } from "react-native";
import { Spacer } from "../atoms/Spacer";
import { Text } from "../atoms/Text";
import { Touchable } from "../atoms/Touchable";
import type { ButtonVariant } from "../themes";
import { useReduceMotion } from "../use-reduce-motion";
import { useTheme } from "../use-theme";

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
};

export function Button({ label, onPress, variant = "primary", loading = false, disabled = false, accessibilityHint }: ButtonProps) {
  const theme = useTheme();
  const t = theme.components.button;
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || loading;
  const look = t.looks[variant][disabled ? "disabled" : loading ? "loading" : pressed ? "pressed" : "normal"];

  const press = (isPressed: boolean) => {
    setPressed(isPressed);
    if (reduceMotion) return; // solo cambia color/opacidad
    Animated.timing(scale, {
      toValue: isPressed ? t.pressedScale : 1,
      duration: isPressed ? theme.motion.pressMs : t.pressOutMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], alignSelf: variant === "ghost" ? "flex-start" : "stretch" }}>
      <Touchable
        onPress={onPress}
        disabled={inactive}
        onPressIn={() => press(true)}
        onPressOut={() => press(false)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: inactive, busy: loading }}
        style={{
          minHeight: t.minHeight[variant],
          minWidth: t.minWidth,
          paddingHorizontal: t.paddingH[variant],
          borderRadius: t.radius,
          backgroundColor: look.bg,
          borderColor: look.border ?? undefined,
          borderWidth: look.border ? t.borderWidth : 0,
          opacity: look.opacity,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <>
            <ActivityIndicator size="small" color={look.fg} />
            <Spacer size="sm" horizontal />
          </>
        ) : null}
        <Text
          variant="button"
          color={look.fg}
          style={{ textAlign: "center", flexShrink: 1, textDecorationLine: look.underline ? "underline" : "none" }}
        >
          {label}
        </Text>
      </Touchable>
    </Animated.View>
  );
}
