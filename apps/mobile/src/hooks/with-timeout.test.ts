import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resuelve con la promesa si se asienta antes", async () => {
    await expect(withTimeout(Promise.resolve(7), 3000)).resolves.toBe(7);
  });

  it("no deja timer pendiente cuando gana la promesa", async () => {
    await withTimeout(Promise.resolve(), 3000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resuelve tras el timeout si la promesa nunca se asienta", async () => {
    const result = withTimeout(new Promise<number>(() => {}), 3000);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toBeUndefined();
  });
});
