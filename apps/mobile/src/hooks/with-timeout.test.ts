import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rejectAfter, withTimeout } from "./with-timeout";

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

describe("rejectAfter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resuelve con la promesa si se asienta antes y no deja timer pendiente", async () => {
    await expect(rejectAfter(Promise.resolve(7), 3000)).resolves.toBe(7);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("propaga el rechazo de la promesa y no deja timer pendiente", async () => {
    await expect(rejectAfter(Promise.reject(new Error("x")), 3000)).rejects.toThrow("x");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rechaza al cumplirse el plazo si la promesa nunca se asienta", async () => {
    const result = rejectAfter(new Promise<number>(() => {}), 3000);
    const assertion = expect(result).rejects.toThrow("Timeout");
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
