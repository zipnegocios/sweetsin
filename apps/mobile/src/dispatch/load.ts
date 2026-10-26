import { isNetworkError } from "../api/network";
import { parseQueue, parseStaff } from "./actions";
import type { DeliveryStaff, QueueOrder } from "./types";

/** Respuesta ya leída (estado + cuerpo JSON, o `null` si un error no trae JSON). */
export type Fetched = { status: number; body: unknown };

export type LoadOutcome = {
  unauthorized: boolean;
  /** 403 en alguna carga: la sesión sigue, se avisa que la cuenta no tiene permiso. */
  forbidden: boolean;
  /** Solo si nada respondió y hubo un error de red (un timeout no cuenta como "sin red"). */
  offline: boolean;
  /** `null`: esta corrida no trajo dato (se conserva el anterior). */
  orders: QueueOrder[] | null;
  staff: DeliveryStaff[] | null;
};

const okBody = (r: PromiseSettledResult<Fetched>) =>
  r.status === "fulfilled" && r.value.status >= 200 && r.value.status < 300 ? r.value.body : undefined;

/** Interpreta la carga de cola + repartidores: cada una falla por separado sin tirar la otra. */
export function interpretLoad(
  queue: PromiseSettledResult<Fetched>,
  staff: PromiseSettledResult<Fetched>,
): LoadOutcome {
  const both = [queue, staff];
  const answered = both.flatMap((r) => (r.status === "fulfilled" ? [r.value.status] : []));
  const queueBody = okBody(queue);
  const staffBody = okBody(staff);
  return {
    unauthorized: answered.includes(401),
    forbidden: answered.includes(403),
    offline: answered.length === 0 && both.some((r) => r.status === "rejected" && isNetworkError(r.reason)),
    orders: queueBody === undefined ? null : parseQueue(queueBody),
    staff: staffBody === undefined ? null : parseStaff(staffBody),
  };
}
