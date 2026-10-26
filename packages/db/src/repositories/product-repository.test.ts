import { describe, it, expect } from "vitest";
import { DrizzleProductRepository } from "./product-repository";

describe("DrizzleProductRepository.findByIds", () => {
  it("devuelve solo los productos pedidos y [] para una lista vacía", async () => {
    const repo = new DrizzleProductRepository();
    const all = await repo.listAvailable();
    const ids = all.slice(0, 2).map((p) => p.id);
    const found = await repo.findByIds([...ids, "00000000-0000-0000-0000-000000000000"]);
    expect(found.map((p) => p.id).sort()).toEqual([...ids].sort());
    expect(await repo.findByIds([])).toEqual([]);
  });
});
