import { describe, it, expect } from "vitest";
import type { User, UserRepository } from "../users";
import type { DeliveryLocation } from "./entities";
import type { DeliveryLocationRepository } from "./ports";
import { recordDeliveryLocation, endDeliveryShift } from "./use-cases";

const NOW = new Date("2026-10-20T12:00:00Z");

function fakeLocations() {
  const rows = new Map<string, DeliveryLocation>();
  const repo: DeliveryLocationRepository = {
    async upsert(l) {
      rows.set(l.userId, l);
    },
    async findLatest(id) {
      return rows.get(id) ?? null;
    },
    async remove(id) {
      rows.delete(id);
    },
  };
  return { repo, rows };
}

function fakeUsers(user: Partial<User> | null): UserRepository {
  return {
    findById: async () => (user ? ({ id: "d1", role: "delivery", isActive: true, ...user } as User) : null),
  } as unknown as UserRepository;
}

const input = (o: Partial<Parameters<typeof recordDeliveryLocation>[1]> = {}) => ({
  userId: "d1",
  lat: 25.7,
  lng: -80.2,
  accuracyMeters: 12,
  recordedAt: new Date(NOW.getTime() - 5_000),
  ...o,
});

describe("recordDeliveryLocation", () => {
  it("guarda la ubicacion de un delivery activo", async () => {
    const { repo, rows } = fakeLocations();
    await recordDeliveryLocation({ locations: repo, users: fakeUsers({}) }, input(), NOW);
    expect(rows.get("d1")).toMatchObject({ lat: 25.7, lng: -80.2, accuracyMeters: 12 });
  });

  it("acepta accuracyMeters null y 0", async () => {
    const { repo, rows } = fakeLocations();
    const deps = { locations: repo, users: fakeUsers({}) };
    await recordDeliveryLocation(deps, input({ accuracyMeters: null }), NOW);
    await recordDeliveryLocation(deps, input({ accuracyMeters: 0 }), NOW);
    expect(rows.get("d1")).toMatchObject({ accuracyMeters: 0 });
  });

  it.each(["customer", "admin", "despachador"] as const)("rechaza el rol %s", async (role) => {
    const { repo, rows } = fakeLocations();
    await expect(
      recordDeliveryLocation({ locations: repo, users: fakeUsers({ role }) }, input(), NOW),
    ).rejects.toThrow();
    expect(rows.size).toBe(0);
  });

  it("rechaza usuario inexistente e inactivo", async () => {
    const { repo } = fakeLocations();
    await expect(recordDeliveryLocation({ locations: repo, users: fakeUsers(null) }, input(), NOW)).rejects.toThrow();
    await expect(
      recordDeliveryLocation({ locations: repo, users: fakeUsers({ isActive: false }) }, input(), NOW),
    ).rejects.toThrow();
  });

  it.each([
    ["lat > 90", { lat: 90.1 }],
    ["lat < -90", { lat: -90.1 }],
    ["lng > 180", { lng: 180.1 }],
    ["lng < -180", { lng: -180.1 }],
    ["lat NaN", { lat: NaN }],
    ["lng NaN", { lng: NaN }],
    ["accuracy negativa", { accuracyMeters: -1 }],
    ["accuracy NaN", { accuracyMeters: NaN }],
    ["accuracy Infinity", { accuracyMeters: Infinity }],
  ])("rechaza coordenadas invalidas: %s", async (_n, o) => {
    const { repo, rows } = fakeLocations();
    await expect(recordDeliveryLocation({ locations: repo, users: fakeUsers({}) }, input(o), NOW)).rejects.toThrow();
    expect(rows.size).toBe(0);
  });

  it("rechaza recordedAt a mas de 1 minuto en el futuro y acepta hasta 1 minuto", async () => {
    const { repo } = fakeLocations();
    const deps = { locations: repo, users: fakeUsers({}) };
    await expect(
      recordDeliveryLocation(deps, input({ recordedAt: new Date(NOW.getTime() + 60_001) }), NOW),
    ).rejects.toThrow();
    await expect(
      recordDeliveryLocation(deps, input({ recordedAt: new Date(NOW.getTime() + 60_000) }), NOW),
    ).resolves.toBeUndefined();
  });

  it("rechaza recordedAt de mas de 10 minutos de antiguedad y fecha invalida", async () => {
    const { repo } = fakeLocations();
    const deps = { locations: repo, users: fakeUsers({}) };
    await expect(
      recordDeliveryLocation(deps, input({ recordedAt: new Date(NOW.getTime() - 600_001) }), NOW),
    ).rejects.toThrow();
    await expect(
      recordDeliveryLocation(deps, input({ recordedAt: new Date(NOW.getTime() - 600_000) }), NOW),
    ).resolves.toBeUndefined();
    await expect(recordDeliveryLocation(deps, input({ recordedAt: new Date("nope") }), NOW)).rejects.toThrow();
  });

  it("una segunda ubicacion reemplaza a la primera", async () => {
    const { repo, rows } = fakeLocations();
    const deps = { locations: repo, users: fakeUsers({}) };
    await recordDeliveryLocation(deps, input({ lat: 1 }), NOW);
    await recordDeliveryLocation(deps, input({ lat: 2 }), NOW);
    expect(rows.size).toBe(1);
    expect(rows.get("d1")?.lat).toBe(2);
  });
});

describe("endDeliveryShift", () => {
  it("borra la ubicacion del delivery", async () => {
    const { repo, rows } = fakeLocations();
    await recordDeliveryLocation({ locations: repo, users: fakeUsers({}) }, input(), NOW);
    await endDeliveryShift({ locations: repo }, "d1");
    expect(rows.size).toBe(0);
  });
});
