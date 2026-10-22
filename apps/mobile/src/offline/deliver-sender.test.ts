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

  it("401 -> unauthorized", async () => {
    const send = makeDeliverSender(async () => new Response("{}", { status: 401 }));
    expect(await send(command)).toEqual({ kind: "unauthorized" });
  });

  it("409 con error -> conflict con esa razon", async () => {
    const error = "Cannot mark delivered from status: cancelled";
    const send = makeDeliverSender(async () => new Response(JSON.stringify({ error }), { status: 409 }));
    expect(await send(command)).toEqual({ kind: "conflict", reason: error });
  });

  it("403 sin JSON -> conflict HTTP 403", async () => {
    const send = makeDeliverSender(async () => new Response("nope", { status: 403 }));
    expect(await send(command)).toEqual({ kind: "conflict", reason: "HTTP 403" });
  });

  it("503 -> retry", async () => {
    const send = makeDeliverSender(async () => new Response("", { status: 503 }));
    expect(await send(command)).toEqual({ kind: "retry" });
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
