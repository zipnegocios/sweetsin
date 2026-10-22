import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// Último valor conocido: evita que un componente montado después arranque animando un frame.
let lastKnown = false;

/** `true` cuando el sistema pide reducir movimiento ("Quitar animaciones" en Android). */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(lastKnown);

  useEffect(() => {
    let active = true;
    const update = (value: boolean) => {
      lastKnown = value;
      if (active) setReduce(value);
    };
    AccessibilityInfo.isReduceMotionEnabled().then(update, () => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", update);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduce;
}
