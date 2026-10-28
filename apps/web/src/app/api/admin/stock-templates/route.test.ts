import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { role: string } } | null,
  error: null as Error | null,
  includeArchived: undefined as boolean | undefined,
}));
const tpl = { id: "t", name: "Base", archivedAt: null, createdAt: new Date(), items: [] };

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleStockTemplateRepository: class {
    async list(includeArchived: boolean) {
      state.includeArchived = includeArchived;
      return [tpl];
    }
    async nameExists() {
      return state.error?.message === "Template name already exists";
    }
    async validProductIds() {}
    async create() {
      if (state.error && state.error.message !== "Template name already exists") throw state.error;
      return tpl;
    }
  },
}));

import { GET, POST } from "./route";

const PID = "11111111-1111-4111-8111-111111111111";
const post = (b: unknown) =>
  new Request("http://localhost/x", { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } });
const valid = { name: "Base", items: [{ productId: PID, quantity: 3 }] };

beforeEach(() => {
  state.session = { user: { role: "admin" } };
  state.error = null;
  state.includeArchived = undefined;
});

describe("/api/admin/stock-templates", () => {
  it("401 sin sesion y 403 para otro rol", async () => {
    state.session = null;
    expect((await GET(new Request("http://x"))).status).toBe(401);
    state.session = { user: { role: "delivery" } };
    expect((await POST(post(valid))).status).toBe(403);
  });

  it("GET respeta includeArchived", async () => {
    const res = await GET(new Request("http://x/?includeArchived=true"));
    expect(res.status).toBe(200);
    expect(state.includeArchived).toBe(true);
    await GET(new Request("http://x/"));
    expect(state.includeArchived).toBe(false);
  });

  it("POST con cuerpo invalido responde 400", async () => {
    expect((await POST(post({ name: 1 }))).status).toBe(400);
    expect((await POST(post({ name: "a", items: [{ productId: "x", quantity: 1 }] }))).status).toBe(400);
  });

  it("POST feliz responde 201", async () => {
    const res = await POST(post(valid));
    expect(res.status).toBe(201);
  });

  it("POST con nombre duplicado responde 409", async () => {
    state.error = new Error("Template name already exists");
    expect((await POST(post(valid))).status).toBe(409);
  });

  it("error desconocido responde 500 sin filtrar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.error = new Error("boom secret");
    const res = await POST(post(valid));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
