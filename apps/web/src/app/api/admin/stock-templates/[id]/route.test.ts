import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { role: string } } | null,
  found: true,
  deleted: [] as string[],
  archived: [] as [string, boolean][],
  nameTaken: false,
}));
const tpl = { id: "t", name: "Base", archivedAt: null, createdAt: new Date(), items: [] };

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleStockTemplateRepository: class {
    async findById() {
      return state.found ? tpl : null;
    }
    async nameExists() {
      return state.nameTaken;
    }
    async update() {
      return tpl;
    }
    async delete(id: string) {
      state.deleted.push(id);
    }
    async setArchived(id: string, a: boolean) {
      state.archived.push([id, a]);
    }
  },
}));

import { GET, PATCH, DELETE } from "./route";
import { POST as ARCHIVE } from "./archive/route";
import { POST as UNARCHIVE } from "./unarchive/route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = { params: Promise.resolve({ id: ID }) };
const bad = { params: Promise.resolve({ id: "nope" }) };
const patch = (b: unknown) =>
  new Request("http://x", { method: "PATCH", body: JSON.stringify(b), headers: { "content-type": "application/json" } });
const valid = { name: "Base", items: [{ productId: ID, quantity: 2 }] };
const req = () => new Request("http://x", { method: "POST" });

beforeEach(() => {
  state.session = { user: { role: "admin" } };
  state.found = true;
  state.nameTaken = false;
  state.deleted = [];
  state.archived = [];
});

describe("/api/admin/stock-templates/[id]", () => {
  it("401 y 403", async () => {
    state.session = null;
    expect((await GET(req(), ctx)).status).toBe(401);
    state.session = { user: { role: "customer" } };
    expect((await DELETE(req(), ctx)).status).toBe(403);
    expect((await ARCHIVE(req(), ctx)).status).toBe(403);
    expect((await UNARCHIVE(req(), ctx)).status).toBe(403);
  });

  it("id no UUID responde 404", async () => {
    expect((await GET(req(), bad)).status).toBe(404);
    expect((await PATCH(patch(valid), bad)).status).toBe(404);
    expect((await DELETE(req(), bad)).status).toBe(404);
    expect((await ARCHIVE(req(), bad)).status).toBe(404);
    expect((await UNARCHIVE(req(), bad)).status).toBe(404);
  });

  it("inexistente responde 404 nombrando la plantilla", async () => {
    state.found = false;
    const res = await GET(req(), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Template not found");
    expect((await DELETE(req(), ctx)).status).toBe(404);
  });

  it("GET, PATCH y DELETE felices", async () => {
    expect((await GET(req(), ctx)).status).toBe(200);
    expect((await PATCH(patch(valid), ctx)).status).toBe(200);
    expect((await DELETE(req(), ctx)).status).toBe(200);
    expect(state.deleted).toEqual([ID]);
  });

  it("PATCH invalido 400 y nombre duplicado 409", async () => {
    expect((await PATCH(patch({ name: 1 }), ctx)).status).toBe(400);
    state.nameTaken = true;
    expect((await PATCH(patch(valid), ctx)).status).toBe(409);
  });

  it("archive y unarchive", async () => {
    expect((await ARCHIVE(req(), ctx)).status).toBe(200);
    expect((await UNARCHIVE(req(), ctx)).status).toBe(200);
    expect(state.archived).toEqual([[ID, true], [ID, false]]);
    state.nameTaken = true;
    expect((await UNARCHIVE(req(), ctx)).status).toBe(409);
  });
});
