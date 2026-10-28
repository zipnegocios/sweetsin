import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const state = vi.hoisted(() => ({
  calls: [] as { deps: Record<string, unknown>; orderId: string; ctx: unknown }[],
  timingEnabled: true,
}));

vi.mock("stripe", () => ({
  default: class {
    webhooks = {
      constructEvent: (body: string) => JSON.parse(body),
    };
  },
}));
vi.mock("@workspace/domain/orders", () => ({
  confirmOrderPayment: vi.fn(async (deps: Record<string, unknown>, orderId: string, ctx: unknown) => {
    state.calls.push({ deps, orderId, ctx });
  }),
}));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {},
  DrizzleStockRepository: class {},
  DrizzleTrailerStopRepository: class {},
  DrizzleUserRepository: class {},
  DrizzleSettingsRepository: class {
    async get() {
      return { timingEnabled: state.timingEnabled };
    }
  },
}));
vi.mock("@/lib/staff-notifications", () => ({ createStaffNotifications: () => ({}) }));

import { POST } from "./route";

const event = (orderId?: string) =>
  new Request("http://localhost/x", {
    method: "POST",
    headers: { "stripe-signature": "sig" },
    body: JSON.stringify({ type: "payment_intent.succeeded", data: { object: { metadata: orderId ? { orderId } : {} } } }),
  });

beforeEach(() => {
  state.calls = [];
  state.timingEnabled = true;
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/webhooks/stripe", () => {
  it("503 sin credenciales de Stripe", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect((await POST(event("o1"))).status).toBe(503);
  });

  it("confirma el pago con source webhook, sin actor, y con paradas y stock cableados", async () => {
    const res = await POST(event("o1"));
    expect(res.status).toBe(200);
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].orderId).toBe("o1");
    expect(state.calls[0].ctx).toEqual({ actorUserId: null, source: "webhook", record: true });
    expect(state.calls[0].deps).toEqual(
      expect.objectContaining({ stops: expect.any(Object), stock: expect.any(Object) }),
    );
  });

  it("con timingEnabled apagado no registra el evento", async () => {
    state.timingEnabled = false;
    await POST(event("o1"));
    expect(state.calls[0].ctx).toEqual(expect.objectContaining({ record: false }));
  });

  it("sin orderId en metadata no confirma nada", async () => {
    expect((await POST(event())).status).toBe(200);
    expect(state.calls).toHaveLength(0);
  });
});
