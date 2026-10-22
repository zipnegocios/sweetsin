import { describe, expect, it } from "vitest";
import { distanceMeters } from "./haversine";
import { canReport, shouldSendLocation } from "./send-policy";

const opts = { minIntervalMs: 20_000, minDistanceMeters: 30 } as const;
const prev = { lat: 0, lng: 0, atMs: 0 };

describe("shouldSendLocation", () => {
  it("sin previo envía", () => {
    expect(shouldSendLocation(null, { lat: 0, lng: 0, atMs: 1 }, opts)).toBe(true);
  });
  it("antes de 20 s y a menos de 30 m no envía", () => {
    expect(shouldSendLocation(prev, { lat: 0.0001, lng: 0, atMs: 10_000 }, opts)).toBe(false);
  });
  it("pasados 20 s envía", () => {
    expect(shouldSendLocation(prev, { lat: 0, lng: 0, atMs: 20_000 }, opts)).toBe(true);
  });
  it("a más de 30 m antes de 20 s envía", () => {
    expect(shouldSendLocation(prev, { lat: 0.001, lng: 0, atMs: 5_000 }, opts)).toBe(true);
  });
});

describe("shouldSendLocation (borde)", () => {
  it("a exactamente 30 m envía: el umbral es >= (el texto del spec dice > 30 m; se fija el >= actual)", () => {
    const next = { lat: 0.0003, lng: 0, atMs: 5_000 };
    const exact = { minIntervalMs: 20_000, minDistanceMeters: distanceMeters(prev, next) };
    expect(shouldSendLocation(prev, next, exact)).toBe(true);
    expect(shouldSendLocation(prev, next, { ...exact, minDistanceMeters: exact.minDistanceMeters + 0.01 })).toBe(false);
  });
});

describe("canReport", () => {
  const ok = { shiftFlagActive: true, trackingActive: true, policyPasses: true };
  it("envía solo si turno persistido, seguimiento activo y la política lo permite", () => {
    expect(canReport(ok)).toBe(true);
    expect(canReport({ ...ok, shiftFlagActive: false })).toBe(false);
    expect(canReport({ ...ok, trackingActive: false })).toBe(false);
    expect(canReport({ ...ok, policyPasses: false })).toBe(false);
  });
});
