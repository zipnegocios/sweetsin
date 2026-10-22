import { isNetworkError } from "../api/network";
import type { DeliverCommand, SendResult } from "./command-queue";

export function makeDeliverSender(
  fetchFn: (path: string, init: RequestInit) => Promise<Response>,
): (command: DeliverCommand) => Promise<SendResult> {
  return async (command) => {
    let res: Response;
    try {
      res = await fetchFn(`/api/mobile/orders/${command.orderId}/deliver`, { method: "PATCH" });
    } catch (error) {
      if (isNetworkError(error)) return { kind: "retry" };
      throw error;
    }
    if (res.ok) return { kind: "ok" };
    if (res.status === 401) return { kind: "unauthorized" };
    if (res.status === 408 || res.status === 429 || res.status >= 500) return { kind: "retry" };
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    return {
      kind: "conflict",
      reason: typeof body?.error === "string" ? body.error : `HTTP ${res.status}`,
    };
  };
}
