import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { userId: string; role: string } | null,
  order: null as Record<string, unknown> | null,
}));

vi.mock("../../../../_lib/require-mobile-auth", () => ({ requireMobileAuth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {
    async findById() {
      return state.order;
    }
  },
}));

import { POST } from "./route";

const ctx = { params: Promise.resolve({ id: "o1" }) };
const req = (body: unknown) =>
  new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body), headers: { authorization: "Bearer t" } });

function configureR2() {
  vi.stubEnv("R2_ACCOUNT_ID", "acct");
  vi.stubEnv("R2_ACCESS_KEY_ID", "ak");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "sk");
  vi.stubEnv("R2_BUCKET", "bucket");
}

beforeEach(() => {
  state.session = { userId: "d1", role: "delivery" };
  state.order = { id: "o1", assignedDeliveryUserId: "d1", fulfillmentStatus: "out_for_delivery" };
  // Aísla el prefijo de cualquier .env.local: los tests asumen el default.
  vi.stubEnv("R2_DELIVERY_EVIDENCE_PREFIX", "delivery-evidence/");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/mobile/orders/[id]/evidence/upload-url", () => {
  it("responde 403 para el rol despachador", async () => {
    state.session = { userId: "x", role: "despachador" };
    expect((await POST(req({ contentType: "image/jpeg" }), ctx)).status).toBe(403);
  });

  it("responde 401 sin sesion valida", async () => {
    state.session = null;
    expect((await POST(req({ contentType: "image/jpeg" }), ctx)).status).toBe(401);
  });

  it("responde 503 sin variables R2", async () => {
    for (const n of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) vi.stubEnv(n, "");
    const res = await POST(req({ contentType: "image/jpeg" }), ctx);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Delivery evidence storage is not configured yet." });
  });

  it("responde 400 con un contentType distinto de image/jpeg", async () => {
    configureR2();
    expect((await POST(req({ contentType: "image/png" }), ctx)).status).toBe(400);
  });

  it("responde 409 si la orden es de otro usuario", async () => {
    configureR2();
    state.order = { id: "o1", assignedDeliveryUserId: "otro", fulfillmentStatus: "out_for_delivery" };
    expect((await POST(req({ contentType: "image/jpeg" }), ctx)).status).toBe(409);
  });

  it("responde 409 si la orden no esta en un estado valido", async () => {
    configureR2();
    state.order = { id: "o1", assignedDeliveryUserId: "d1", fulfillmentStatus: "ready_for_pickup" };
    expect((await POST(req({ contentType: "image/jpeg" }), ctx)).status).toBe(409);
  });

  it("responde 200 con uploadUrl y una key de la orden", async () => {
    configureR2();
    const res = await POST(req({ contentType: "image/jpeg" }), ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.key).toMatch(/^delivery-evidence\/o1\/[\w-]+\.jpg$/);
    expect(body.uploadUrl).toContain(body.key);
  });
});
