import { describe, expect, it } from "vitest";
import { hasAttentionActions, parseAttentionReason } from "./order-attention";

describe("parseAttentionReason", () => {
  it("reconoce order_cancelled y no ofrece acciones para él", () => {
    expect(parseAttentionReason("order_cancelled")).toEqual({ kind: "order_cancelled" });
    expect(hasAttentionActions("order_cancelled")).toBe(false);
    expect(hasAttentionActions("stop_cancelled")).toBe(true);
    expect(hasAttentionActions(null)).toBe(false);
  });

  it("extrae el producto de insufficient_stock", () => {
    expect(parseAttentionReason("insufficient_stock:p-1")).toEqual({ kind: "insufficient_stock", productId: "p-1" });
  });
  it("reconoce order_cancelled y no ofrece acciones para él", () => {
    expect(parseAttentionReason("order_cancelled")).toEqual({ kind: "order_cancelled" });
    expect(hasAttentionActions("order_cancelled")).toBe(false);
    expect(hasAttentionActions("stop_cancelled")).toBe(true);
    expect(hasAttentionActions(null)).toBe(false);
  });

  it("reconoce stop_cancelled", () => {
    expect(parseAttentionReason("stop_cancelled")).toEqual({ kind: "stop_cancelled" });
  });
  it("reconoce order_cancelled y no ofrece acciones para él", () => {
    expect(parseAttentionReason("order_cancelled")).toEqual({ kind: "order_cancelled" });
    expect(hasAttentionActions("order_cancelled")).toBe(false);
    expect(hasAttentionActions("stop_cancelled")).toBe(true);
    expect(hasAttentionActions(null)).toBe(false);
  });

  it("devuelve other para lo desconocido o incompleto", () => {
    expect(parseAttentionReason("insufficient_stock:")).toEqual({ kind: "other", raw: "insufficient_stock:" });
    expect(parseAttentionReason("boom")).toEqual({ kind: "other", raw: "boom" });
  });
});
