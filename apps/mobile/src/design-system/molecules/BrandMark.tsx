import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { useReduceMotion } from "../use-reduce-motion";

// Activos de marca de la APK (única salida permitida de design-system/, ver architecture.test.ts).
const ANIMATED = {
  isotipo: require("../../../assets/brand/isotipo.gif"),
  videologo: require("../../../assets/brand/videologo.gif"),
};
const STATIC = require("../../../assets/brand/mascot.png");

export type BrandMarkProps = {
  variant: "isotipo" | "videologo";
  size: number;
  animated?: boolean;
  /** Pasado este tiempo cambia a la imagen estática (un ciclo del GIF). */
  playOnceMs?: number;
  /** Sin etiqueta la marca es decorativa y el lector de pantalla la salta. */
  accessibilityLabel?: string;
};

/**
 * Mascota de marca. GIF animado solo si `animated`, sin "reducir movimiento" y sin error de carga;
 * si no, `mascot.png` estática. Nunca animada dentro de una lista de trabajo ni de una tarjeta.
 */
export function BrandMark({ variant, size, animated = true, playOnceMs, accessibilityLabel }: BrandMarkProps) {
  const reduceMotion = useReduceMotion();
  const [failed, setFailed] = useState(false);
  const [expired, setExpired] = useState(false);
  const showAnimated = animated && !reduceMotion && !failed && !expired;

  useEffect(() => {
    if (!showAnimated || playOnceMs === undefined) return;
    const timer = setTimeout(() => setExpired(true), playOnceMs);
    return () => clearTimeout(timer);
  }, [showAnimated, playOnceMs]);

  return (
    <Image
      source={showAnimated ? ANIMATED[variant] : STATIC}
      onError={showAnimated ? () => setFailed(true) : undefined}
      contentFit="contain"
      style={{ width: size, height: size }}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel !== undefined ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
