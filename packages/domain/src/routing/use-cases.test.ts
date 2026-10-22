import { describe, it, expect, vi } from "vitest";
import { getRouteForOrder } from "./use-cases";
import type { RouteInfo, RoutePlanner } from "./entities";
import type { Order } from "../orders/entities";
import type { OrderRepository } from "../orders/ports";

const route: RouteInfo = {
  etaSeconds: 720,
  distanceMeters: 3400,
  encodedPolyline: "abc",
  origin: { lat: 25.7, lng: -80.2 },
  destination: { lat: 25.8, lng: -80.3 },
  computedAt: new Date("2026-10-20T12:00:00Z"),
};

function setup(overrides: Partial<Order> | null = {}) {
  const order = overrides === null ? null : ({
    id: "o1",
    assignedDeliveryUserId: "d1",
    fulfillmentStatus: "out_for_delivery",
    deliveryAddress: "1 Main St, Miami",
    ...overrides,
  } as Order);
  const planner: RoutePlanner = { computeRoute: vi.fn(async () => route) };
  const orders = { findById: async () => order } as unknown as OrderRepository;
  return { planner, deps: { orders, planner } };
}
const actor = { userId: "d1", role: "delivery" as const };
const origin = { lat: 25.7, lng: -80.2 };

describe("getRouteForOrder", () => {
  it("acepta al delivery asignado con la orden out_for_delivery", async () => {
    const { deps, planner } = setup();
    expect(await getRouteForOrder(deps, "o1", actor, origin)).toBe(route);
    expect(planner.computeRoute).toHaveBeenCalledWith(origin, "1 Main St, Miami");
  });

  it("rechaza una orden inexistente", async () => {
    const { deps } = setup(null);
    await expect(getRouteForOrder(deps, "o1", actor, origin)).rejects.toThrow("Order not found");
  });

  it("rechaza a otro delivery", async () => {
    const { deps, planner } = setup();
    await expect(getRouteForOrder(deps, "o1", { ...actor, userId: "d2" }, origin)).rejects.toThrow(/assigned delivery/);
    expect(planner.computeRoute).not.toHaveBeenCalled();
  });

  it.each(["pending", "ready_for_pickup", "delivered", "cancelled"] as const)("rechaza el estado %s", async (s) => {
    const { deps } = setup({ fulfillmentStatus: s });
    await expect(getRouteForOrder(deps, "o1", actor, origin)).rejects.toThrow(/status/);
  });

  it("rechaza deliveryAddress nula", async () => {
    const { deps } = setup({ deliveryAddress: null });
    await expect(getRouteForOrder(deps, "o1", actor, origin)).rejects.toThrow(/address/);
  });

  it.each([
    [{ lat: 91, lng: 0 }, /Latitude/],
    [{ lat: -91, lng: 0 }, /Latitude/],
    [{ lat: NaN, lng: 0 }, /Latitude/],
    [{ lat: 0, lng: -181 }, /Longitude/],
    [{ lat: 0, lng: 181 }, /Longitude/],
    [{ lat: 0, lng: NaN }, /Longitude/],
  ])("rechaza el origen %j", async (o, msg) => {
    const { deps, planner } = setup();
    await expect(getRouteForOrder(deps, "o1", actor, o)).rejects.toThrow(msg);
    expect(planner.computeRoute).not.toHaveBeenCalled();
  });
});
