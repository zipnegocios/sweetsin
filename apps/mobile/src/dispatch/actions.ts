import type {
  DeliveryStaff,
  DispatchAction,
  DispatchResult,
  QueueOrder,
} from "./types";

export type { DeliveryStaff, DispatchAction, DispatchResult, QueueOrder } from "./types";

export function nextAction(order: QueueOrder): DispatchAction {
  switch (order.fulfillmentStatus) {
    case "received":
      return { kind: "start_prep" };
    case "in_prep":
      return { kind: "mark_ready" };
    case "ready_for_pickup":
      return order.fulfillmentType === "self_delivery" ? { kind: "assign" } : { kind: "none" };
  }
}

type Row = Record<string, unknown>;

const isRow = (v: unknown): v is Row => typeof v === "object" && v !== null;

function rowsOf(body: unknown, key: string): unknown[] {
  if (!isRow(body)) return [];
  const list = body[key];
  return Array.isArray(list) ? list : [];
}

function toQueueOrder(r: unknown): QueueOrder | null {
  if (!isRow(r)) return null;
  const { id, customerName, customerPhone, fulfillmentType, fulfillmentStatus } = r;
  const { deliveryAddress, totalCents, itemCount } = r;
  if (typeof id !== "string" || id === "") return null;
  if (typeof customerName !== "string" || typeof customerPhone !== "string") return null;
  if (fulfillmentType !== "pickup" && fulfillmentType !== "self_delivery") return null;
  if (
    fulfillmentStatus !== "received" &&
    fulfillmentStatus !== "in_prep" &&
    fulfillmentStatus !== "ready_for_pickup"
  ) {
    return null;
  }
  if (deliveryAddress !== null && typeof deliveryAddress !== "string") return null;
  if (typeof totalCents !== "number" || typeof itemCount !== "number") return null;
  return {
    id,
    customerName,
    customerPhone,
    fulfillmentType,
    fulfillmentStatus,
    deliveryAddress,
    totalCents,
    itemCount,
  };
}

export function parseQueue(body: unknown): QueueOrder[] {
  return rowsOf(body, "orders").flatMap((r) => toQueueOrder(r) ?? []);
}

export function parseStaff(body: unknown): DeliveryStaff[] {
  return rowsOf(body, "staff").flatMap((r) =>
    isRow(r) && typeof r.id === "string" && typeof r.name === "string"
      ? [{ id: r.id, name: r.name }]
      : [],
  );
}

export function classifyDispatchResponse(status: number, body: unknown): DispatchResult {
  if (status >= 200 && status < 300) return { kind: "ok" };
  if (status === 401) return { kind: "unauthorized" };
  if (status === 403) return { kind: "forbidden" };
  if (status === 409) {
    const error = isRow(body) ? body.error : undefined;
    return { kind: "conflict", reason: typeof error === "string" ? error : "" };
  }
  return { kind: "server" };
}
