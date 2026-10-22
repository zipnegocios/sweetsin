import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/** Ejecuta `callback` al montar, al volver la app a primer plano y cada `intervalMs`. */
export function usePolling(callback: () => void | Promise<void>, intervalMs: number): void {
  const latest = useRef(callback);
  latest.current = callback;

  useEffect(() => {
    const run = () => void latest.current();
    run();
    const timer = setInterval(run, intervalMs);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [intervalMs]);
}
