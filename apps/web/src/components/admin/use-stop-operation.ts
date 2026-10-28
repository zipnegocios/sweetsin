"use client";

import { useRef, useState } from "react";
import { stopOperationError, type StopOperationError } from "@/lib/stop-operation-error";

type ActionResult = { ok: true } | { ok: false; error: string } | { error: string };

/**
 * Ejecuta una acción admin de operación (abrir/cerrar parada, stock en vivo, atención de pedidos):
 * bloquea el doble envío y deja el error ya mapeado a su clave i18n.
 */
export function useStopOperation() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<StopOperationError | null>(null);
  const inFlight = useRef(false);

  async function run(fn: () => Promise<ActionResult>, onOk?: () => void): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setError(null);
    setIsPending(true);
    try {
      const result = await fn();
      if ("ok" in result && result.ok) {
        onOk?.();
        return true;
      }
      setError(stopOperationError("error" in result ? result.error : "generic"));
      return false;
    } catch {
      setError({ key: "opErrorGeneric" });
      return false;
    } finally {
      inFlight.current = false;
      setIsPending(false);
    }
  }

  return { isPending, error, setError, run };
}
