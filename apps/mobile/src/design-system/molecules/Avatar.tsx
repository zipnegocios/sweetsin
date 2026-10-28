import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "../atoms/Text";
import { useReduceMotion } from "../use-reduce-motion";
import { useTheme } from "../use-theme";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");

// La URL de R2 trae una firma que cambia en cada petición: sin ella la caché en disco sirve la misma foto.
const stableCacheKey = (url: string) => url.split("?")[0];

export type AvatarProps = {
  name: string;
  photoUrl: string | null;
  /** `header`: miniatura de la cabecera. `card`: foto grande de la credencial. */
  size: "header" | "card";
};

/** Foto redonda del staff. Sin foto, o si no se puede descargar, muestra las iniciales (nunca un hueco). */
export function Avatar({ name, photoUrl, size }: AvatarProps) {
  const t = useTheme().components.avatar;
  const reduceMotion = useReduceMotion();
  const [failed, setFailed] = useState(false);
  const dimension = t.sizes[size];
  const card = size === "card";

  useEffect(() => setFailed(false), [photoUrl]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: t.bg,
        borderWidth: card ? t.borderWidthCard : t.borderWidth,
        borderColor: card ? t.borderCard : t.border,
      }}
    >
      {photoUrl && !failed ? (
        <Image
          source={{ uri: photoUrl, cacheKey: stableCacheKey(photoUrl) }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={reduceMotion ? 0 : t.transitionMs}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text variant={card ? "title" : "bodyStrong"} color={t.fg}>
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}
