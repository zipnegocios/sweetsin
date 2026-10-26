import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { userId: string; role: string } | null,
  order: null as Record<string, unknown> | null,
  recorded: [] as unknown[],
}));

vi.mock("../../../_lib/require-mobile-auth", () => ({ requireMobileAuth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {
    async findById() {
      return state.order;
    }
    async recordDeliveryEvidence(_id: string, evidence: unknown) {
      state.recorded.push(evidence);
    }
  },
}));

import { POST } from "./route";

const ctx = { params: Promise.resolve({ id: "o1" }) };
const valid = { key: "delivery-evidence/o1/u1.jpg", capturedAt: "2026-10-20T12:00:00Z", lat: 25.7, lng: -80.2 };
const req = (body: unknown) =>
  new Request("http://localhost/x", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { authorization: "Bearer t" },
  });

beforeEach(() => {
  state.session = { userId: "d1", role: "delivery" };
  state.order = { id: "o1", assignedDeliveryUserId: "d1", fulfillmentStatus: "out_for_delivery" };
  state.recorded = [];
  // Aísla el prefijo de cualquier .env.local: los tests asumen el default.
  vi.stubEnv("R2_DELIVERY_EVIDENCE_PREFIX", "delivery-evidence/");
  vi.stubEnv("R2_ACCOUNT_ID", "acct");
  vi.stubEnv("R2_ACCESS_KEY_ID", "ak");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "sk");
  vi.stubEnv("R2_BUCKET", "bucket");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/mobile/orders/[id]/evidence", () => {
  it("responde 403 para el rol despachador", async () => {
    state.session = { userId: "x", role: "despachador" };
    expect((await POST(req(valid), ctx)).status).toBe(403);
  });

  it("responde 401 sin sesion valida", async () => {
    state.session = null;
    expect((await POST(req(valid), ctx)).status).toBe(401);
    expect(state.recorded).toHaveLength(0);
  });

  it("responde 503 sin variables R2", async () => {
    vi.stubEnv("R2_BUCKET", "");
    const res = await POST(req(valid), ctx);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Delivery evidence storage is not configured yet." });
  });

  it("responde 400 con body invalido", async () => {
    expect((await POST(req("no-json"), ctx)).status).toBe(400);
    expect((await POST(req({ ...valid, lat: "x" }), ctx)).status).toBe(400);
    expect((await POST(req({ ...valid, capturedAt: "nope" }), ctx)).status).toBe(400);
  });

  it("responde 409 con una key de otra orden", async () => {
    const res = await POST(req({ ...valid, key: "delivery-evidence/o2/u1.jpg" }), ctx);
    expect(res.status).toBe(409);
    expect(state.recorded).toHaveLength(0);
  });

  it("responde 409 si el usuario no es el asignado", async () => {
    state.order = { id: "o1", assignedDeliveryUserId: "otro", fulfillmentStatus: "out_for_delivery" };
    expect((await POST(req(valid), ctx)).status).toBe(409);
  });

  it("registra la evidencia y responde 200", async () => {
    const res = await POST(req(valid), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(state.recorded).toEqual([{ ...valid, capturedAt: new Date(valid.capturedAt) }]);
  });
});
