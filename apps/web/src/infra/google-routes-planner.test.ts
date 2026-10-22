import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GoogleRoutesPlanner, RoutesNotConfiguredError, RouteNotFoundError, RoutesUpstreamError } from "./google-routes-planner";

const KEY = "test-routes-key-123";
const okBody = {
  routes: [
    {
      duration: "720s",
      distanceMeters: 3400,
      polyline: { encodedPolyline: "_p~iF~ps|U" },
      legs: [{ endLocation: { latLng: { latitude: 25.8, longitude: -80.3 } } }],
    },
  ],
};
const origin = { lat: 25.7, lng: -80.2 };

beforeEach(() => vi.stubEnv("GOOGLE_ROUTES_API_KEY", KEY));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GoogleRoutesPlanner", () => {
  it("se importa sin variables de entorno (validacion perezosa)", async () => {
    vi.stubEnv("GOOGLE_ROUTES_API_KEY", "");
    await expect(import("./google-routes-planner")).resolves.toBeDefined();
  }, 30_000);

  it("sin clave lanza RoutesNotConfiguredError y no llama a fetch", async () => {
    vi.stubEnv("GOOGLE_ROUTES_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(new GoogleRoutesPlanner().computeRoute(origin, "x")).rejects.toBeInstanceOf(RoutesNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia las cabeceras y el cuerpo del contrato y mapea la respuesta", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(okBody), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const route = await new GoogleRoutesPlanner().computeRoute(origin, "1 Main St");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://routes.googleapis.com/directions/v2:computeRoutes");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.endLocation",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      origin: { location: { latLng: { latitude: 25.7, longitude: -80.2 } } },
      destination: { address: "1 Main St" },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "en-US",
      units: "METRIC",
    });
    expect(route).toMatchObject({
      etaSeconds: 720,
      distanceMeters: 3400,
      encodedPolyline: "_p~iF~ps|U",
      origin,
      destination: { lat: 25.8, lng: -80.3 },
    });
    expect(route.computedAt).toBeInstanceOf(Date);
  });

  it("sin rutas lanza RouteNotFoundError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    await expect(new GoogleRoutesPlanner().computeRoute(origin, "x")).rejects.toBeInstanceOf(RouteNotFoundError);
  });

  it("ante un error HTTP lanza sin filtrar la clave", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`bad key ${KEY}`, { status: 403 })));
    const err = await new GoogleRoutesPlanner().computeRoute(origin, "x").then(() => new Error("no lanzo"), (e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("403");
    expect(err.message).not.toContain(KEY);
  });

  it("envia una senal de timeout a fetch", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(okBody), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await new GoogleRoutesPlanner().computeRoute(origin, "x");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each(["TimeoutError", "AbortError"])("un %s se convierte en RoutesUpstreamError", async (name) => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("late", name); }));
    await expect(new GoogleRoutesPlanner().computeRoute(origin, "x")).rejects.toBeInstanceOf(RoutesUpstreamError);
  });

  it("un fallo de red se convierte en RoutesUpstreamError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(new GoogleRoutesPlanner().computeRoute(origin, "x")).rejects.toBeInstanceOf(RoutesUpstreamError);
  });

  it("un HTTP no 2xx es RoutesUpstreamError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
    await expect(new GoogleRoutesPlanner().computeRoute(origin, "x")).rejects.toBeInstanceOf(RoutesUpstreamError);
  });

  it("sin distanceMeters (proto3 omite el 0) devuelve distancia 0", async () => {
    const route = { ...okBody.routes[0], duration: "0s", distanceMeters: undefined };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ routes: [route] }), { status: 200 })));
    await expect(new GoogleRoutesPlanner().computeRoute(origin, "x")).resolves.toMatchObject({
      distanceMeters: 0,
      etaSeconds: 0,
    });
  });

  it("un 200 que no es JSON es RoutesUpstreamError sin texto del cuerpo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 200 })));
    const err = await new GoogleRoutesPlanner().computeRoute(origin, "x").then(() => new Error("no lanzo"), (e: Error) => e);
    expect(err).toBeInstanceOf(RoutesUpstreamError);
    expect(err.message).not.toContain("html");
  });

  it.each([
    ["sin polyline", { ...okBody.routes[0], polyline: undefined }],
    ["duration no parseable", { ...okBody.routes[0], duration: "abc" }],
    ["distanceMeters presente no numerico", { ...okBody.routes[0], distanceMeters: "abc" }],
    ["sin duration", { ...okBody.routes[0], duration: undefined }],
    ["legs es un objeto", { ...okBody.routes[0], legs: {} }],
    ["legs sin endLocation", { ...okBody.routes[0], legs: [{}] }],
  ])("un 200 con forma inesperada (%s) es RoutesUpstreamError", async (_n, route) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ routes: [route] }), { status: 200 })));
    await expect(new GoogleRoutesPlanner().computeRoute(origin, "x")).rejects.toBeInstanceOf(RoutesUpstreamError);
  });
});
