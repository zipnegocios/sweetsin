export type QueueStatus = "received" | "in_prep" | "ready_for_pickup";
export type FulfillmentType = "pickup" | "self_delivery";

export type QueueOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  fulfillmentStatus: QueueStatus;
  deliveryAddress: string | null;
  totalCents: number;
  itemCount: number;
};

export type DeliveryStaff = { id: string; name: string };

export type DispatchAction =
  | { kind: "start_prep" }
  | { kind: "mark_ready" }
  | { kind: "assign" }
  | { kind: "none" };

export type DispatchResult =
  | { kind: "ok" }
  | { kind: "unauthorized" }
  | { kind: "conflict"; reason: string }
  | { kind: "forbidden" }
  | { kind: "server" };
