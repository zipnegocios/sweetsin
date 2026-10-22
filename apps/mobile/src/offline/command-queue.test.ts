import { describe, expect, it, vi } from "vitest";
import {
  enqueueDeliver,
  flushQueue,
  type CommandStore,
  type DeliverCommand,
  type SendResult,
} from "./command-queue";

function memoryStore(): CommandStore & { items: DeliverCommand[] } {
  const items: DeliverCommand[] = [];
  return {
    items,
    list: async () => [...items].sort((a, b) => a.createdAt - b.createdAt),
    add: async (command) => {
      const i = items.findIndex((c) => c.orderId === command.orderId);
      if (i >= 0) items[i] = command;
      else items.push(command);
    },
    remove: async (orderId) => {
      const i = items.findIndex((c) => c.orderId === orderId);
      if (i >= 0) items.splice(i, 1);
    },
  };
}

async function seed(store: CommandStore, ids: string[]) {
  let t = 1;
  for (const id of ids) await enqueueDeliver(store, id, () => t++);
}

describe("enqueueDeliver", () => {
  it("deja un solo comando si se encola dos veces el mismo orderId", async () => {
    const store = memoryStore();
    await enqueueDeliver(store, "A", () => 1);
    await enqueueDeliver(store, "A", () => 2);
    expect(await store.list()).toHaveLength(1);
  });
});

describe("flushQueue", () => {
  it("envia por createdAt y deja el store vacio", async () => {
    const store = memoryStore();
    await enqueueDeliver(store, "B", () => 2);
    await enqueueDeliver(store, "A", () => 1);
    const sent: string[] = [];
    const report = await flushQueue(store, async (c) => {
      sent.push(c.orderId);
      return { kind: "ok" };
    });
    expect(sent).toEqual(["A", "B"]);
    expect(report).toEqual({ synced: ["A", "B"], conflicts: [], remaining: 0, unauthorized: false });
    expect(await store.list()).toEqual([]);
  });

  it("se detiene en el primer retry y conserva el orden", async () => {
    const store = memoryStore();
    await seed(store, ["A", "B", "C"]);
    const results: SendResult[] = [{ kind: "ok" }, { kind: "retry" }];
    const send = vi.fn(async () => results.shift()!);
    const report = await flushQueue(store, send);
    expect(report.synced).toEqual(["A"]);
    expect(report.remaining).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect((await store.list()).map((c) => c.orderId)).toEqual(["B", "C"]);
  });

  it("elimina los conflictos, los reporta y continua", async () => {
    const store = memoryStore();
    await seed(store, ["A", "B"]);
    const report = await flushQueue(store, async (c) =>
      c.orderId === "A" ? { kind: "conflict", reason: "cancelled" } : { kind: "ok" },
    );
    expect(report.conflicts).toEqual([{ orderId: "A", reason: "cancelled" }]);
    expect(report.synced).toEqual(["B"]);
    expect(await store.list()).toEqual([]);
  });

  it("unauthorized detiene el vaciado y conserva el comando", async () => {
    const store = memoryStore();
    await seed(store, ["A", "B"]);
    const send = vi.fn(async () => ({ kind: "unauthorized" }) as SendResult);
    const report = await flushQueue(store, send);
    expect(report.unauthorized).toBe(true);
    expect(report.remaining).toBe(2);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await store.list()).map((c) => c.orderId)).toEqual(["A", "B"]);
  });
});
