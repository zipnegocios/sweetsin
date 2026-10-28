import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { id?: string; role: string } } | null,
  perStaff: false,
  filters: [] as { from: Date; to: Date; stopId?: string }[],
}));

const at = (iso: string) => new Date(iso);
const ev = (toStatus: string, iso: string, actorUserId: string | null = "staff-1") => ({
  kind: "fulfillment" as const,
  fromStatus: null,
  toStatus,
  occurredAt: at(iso),
  actorUserId,
});
// Creado 2026-10-27T14:00Z = 28/10 00:30 en Adelaida (el día UTC sería el 27).
const row = {
  orderId: "o1",
  stopId: null,
  fulfillmentType: "pickup" as const,
  channel: "web" as const,
  totalCents: 1000,
  units: 2,
  coffeeUnits: 0,
  sweetUnits: 2,
  createdAt: at("2026-10-27T14:00:00Z"),
  cancelled: false,
  events: [
    ev("received", "2026-10-27T14:00:00Z", null),
    ev("in_prep", "2026-10-27T14:01:00Z"),
    ev("ready_for_pickup", "2026-10-27T14:05:00Z"),
    ev("delivered", "2026-10-27T14:10:00Z"),
  ],
};

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderTimingRepository: class {
    async listForReport(filter: { from: Date; to: Date; stopId?: string }) {
      state.filters.push(filter);
      return [row];
    }
  },
  DrizzleSettingsRepository: class {
    async get() {
      return { showPerStaffBreakdown: state.perStaff };
    }
  },
}));

import { GET } from "./route";

const STOP = "11111111-1111-4111-8111-111111111111";
const get = (qs: string) => new Request(`http://localhost/api/admin/reports/fulfillment?${qs}`);

beforeEach(() => {
  state.session = { user: { id: "admin-1", role: "admin" } };
  state.perStaff = false;
  state.filters = [];
});

describe("GET /api/admin/reports/fulfillment", () => {
  it("401 sin sesión y 403 para otro rol", async () => {
    state.session = null;
    expect((await GET(get("from=2026-10-01&to=2026-10-31"))).status).toBe(401);
    state.session = { user: { role: "despachador" } };
    expect((await GET(get("from=2026-10-01&to=2026-10-31"))).status).toBe(403);
  });

  it("400 sin fechas, con fechas inválidas, from > to, groupBy o stopId inválidos", async () => {
    expect((await GET(get("to=2026-10-31"))).status).toBe(400);
    expect((await GET(get("from=nope&to=2026-10-31"))).status).toBe(400);
    expect((await GET(get("from=2026-11-01&to=2026-10-31"))).status).toBe(400);
    expect((await GET(get("from=2026-10-01&to=2026-10-31&groupBy=weekday"))).status).toBe(400);
    expect((await GET(get("from=2026-10-01&to=2026-10-31&stopId=x"))).status).toBe(400);
    expect(state.filters).toEqual([]);
  });

  it("200 JSON: días completos de Adelaida, filtro por parada y día de Adelaida como clave", async () => {
    const res = await GET(get(`from=2026-10-28&to=2026-10-28&stopId=${STOP}&groupBy=day`));
    expect(res.status).toBe(200);
    expect(state.filters).toEqual([
      { from: at("2026-10-27T13:30:00.000Z"), to: at("2026-10-28T13:29:59.999Z"), stopId: STOP },
    ]);
    const { report } = await res.json();
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]).toMatchObject({ key: "2026-10-28", orders: 1, inProgress: 0 });
    expect(report.groups[0].segments.total).toMatchObject({ count: 1, medianMs: 600_000, smallSample: true });
    expect(report.slowest).toEqual([{ orderId: "o1", totalMs: 600_000 }]);
  });

  it("groupBy=staff: 409 con el desglose por persona apagado; 200 si está encendido", async () => {
    const res = await GET(get("from=2026-10-01&to=2026-10-31&groupBy=staff"));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Per-staff breakdown is disabled" });
    expect(state.filters).toEqual([]);
    state.perStaff = true;
    const ok = await GET(get("from=2026-10-01&to=2026-10-31&groupBy=staff"));
    expect(ok.status).toBe(200);
    expect((await ok.json()).report.groups.map((g: { key: string }) => g.key)).toEqual(["staff-1"]);
  });

  it("format=csv responde text/csv con la línea de encabezado", async () => {
    const res = await GET(get("from=2026-10-01&to=2026-10-31&format=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/csv/);
    const lines = (await res.text()).split("\n");
    expect(lines[0]).toBe("group,segment,count,median_seconds,p90_seconds,small_sample");
    expect(lines).toContain("all,total,1,600.0,600.0,true");
  });
});
