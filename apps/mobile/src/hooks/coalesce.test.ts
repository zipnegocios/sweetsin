import { describe, expect, it, vi } from "vitest";
import { makeCoalescer } from "./coalesce";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("makeCoalescer", () => {
  it("nunca corre dos jobs a la vez y repite una sola vez ante varios pedidos", async () => {
    let running = 0;
    let maxRunning = 0;
    let runs = 0;
    const gates = [deferred(), deferred()];
    const c = makeCoalescer(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await gates[runs++].promise;
      running--;
    });
    const first = c.call();
    const second = c.call();
    const third = c.call();
    gates[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    gates[1].resolve();
    await Promise.all([first, second, third]);
    expect(runs).toBe(2);
    expect(maxRunning).toBe(1);
  });

  it("quien pidió durante la corrida 1 resuelve recién tras la repetición", async () => {
    const gates = [deferred(), deferred()];
    let finished = 0;
    let runs = 0;
    const c = makeCoalescer(async () => {
      await gates[runs++].promise;
      finished++;
    });
    void c.call();
    const late = c.call();
    let lateDone = false;
    void late.then(() => (lateDone = true));
    gates[0].resolve();
    await vi.waitFor(() => expect(finished).toBe(1));
    expect(lateDone).toBe(false);
    gates[1].resolve();
    await late;
    expect(finished).toBe(2);
  });

  it("un error del job no traba el runner", async () => {
    let runs = 0;
    const c = makeCoalescer(async () => {
      runs++;
      if (runs === 1) throw new Error("boom");
    });
    await c.call();
    await c.call();
    expect(runs).toBe(2);
  });

  it("idle espera la corrida en curso", async () => {
    const gate = deferred();
    let done = false;
    const c = makeCoalescer(async () => {
      await gate.promise;
      done = true;
    });
    void c.call();
    const idle = c.idle();
    gate.resolve();
    await idle;
    expect(done).toBe(true);
  });
});
