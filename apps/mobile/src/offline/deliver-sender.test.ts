import { describe, expect, it, vi } from "vitest";
import { makeDeliverSender } from "./deliver-sender";

const command = { orderId: "o1", createdAt: 1 };

describe("makeDeliverSender", () => {
  it("200 -> ok y consulta PATCH al endpoint de deliver", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    expect(await makeDeliverSender(fetchFn)(command)).toEqual({ kind: "ok" });
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/mobile/orders/o1/deliver",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("401 (sesion invalida: JWT vencido o usuario inactivo) -> unauthorized, el comando queda en cola", async () => {
    const send = makeDeliverSender(async () => new Response("{}", { status: 401 }));
    expect(await send(command)).toEqual({ kind: "unauthorized" });
  });

  it("409 con error -> conflict con esa razon", async () => {
    const error = "Cannot mark delivered from status: cancelled";
    const send = makeDeliverSender(async () => new Response(JSON.stringify({ error }), { status: 409 }));
    expect(await send(command)).toEqual({ kind: "conflict", reason: error });
  });

  it("403 (el servidor solo lo emite por rol incorrecto) sin JSON -> conflict HTTP 403", async () => {
    const send = makeDeliverSender(async () => new Response("nope", { status: 403 }));
    expect(await send(command)).toEqual({ kind: "conflict", reason: "HTTP 403" });
  });

  it("503 -> retry", async () => {
    const send = makeDeliverSender(async () => new Response("", { status: 503 }));
    expect(await send(command)).toEqual({ kind: "retry" });
  });

  it.each([408, 429])("%i -> retry (fallo transitorio, no borra el comando)", async (status) => {
    const send = makeDeliverSender(async () => new Response("", { status }));
    expect(await send(command)).toEqual({ kind: "retry" });
  });

  it.each([400, 403, 404, 409])("%i (rechazo definitivo, no de sesion) -> conflict", async (status) => {
    const send = makeDeliverSender(async () => new Response("{}", { status }));
    expect(await send(command)).toEqual({ kind: "conflict", reason: `HTTP ${status}` });
  });

  it("TypeError de red -> retry", async () => {
    const send = makeDeliverSender(async () => {
      throw new TypeError("Network request failed");
    });
    expect(await send(command)).toEqual({ kind: "retry" });
  });

  it("otras excepciones se propagan", async () => {
    const send = makeDeliverSender(async () => {
      throw new Error("boom");
    });
    await expect(send(command)).rejects.toThrow("boom");
  });
});
