import { useState } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { Surface } from "../atoms/Surface";
import { Text } from "../atoms/Text";
import { useTheme } from "../use-theme";

export type TextFieldProps = Pick<
  TextInputProps,
  "value" | "onChangeText" | "keyboardType" | "inputMode" | "autoCapitalize" | "autoComplete" | "secureTextEntry" | "maxLength" | "returnKeyType" | "onSubmitEditing"
> & { label: string; inputRef?: React.RefObject<TextInput | null> };

/** Campo con etiqueta visible encima; el borde engrosa y oscurece al enfocar. */
export function TextField({ label, inputRef, ...input }: TextFieldProps) {
  const theme = useTheme();
  const t = theme.components.field;
  const [focused, setFocused] = useState(false);
  return (
    <Surface tone="background" style={{ gap: t.labelGap }}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={inputRef}
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={t.placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...theme.type.body,
          color: theme.colors.textPrimary,
          backgroundColor: t.bg,
          minHeight: t.minHeight,
          paddingHorizontal: t.paddingH,
          borderRadius: t.radius,
          borderWidth: focused ? t.borderWidthFocus : t.borderWidth,
          borderColor: focused ? t.borderFocus : t.border,
        }}
      />
    </Surface>
  );
}
