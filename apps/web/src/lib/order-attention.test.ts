import { describe, expect, it } from "vitest";
import { parseAttentionReason } from "./order-attention";

describe("parseAttentionReason", () => {
  it("extrae el producto de insufficient_stock", () => {
    expect(parseAttentionReason("insufficient_stock:p-1")).toEqual({ kind: "insufficient_stock", productId: "p-1" });
  });
  it("reconoce stop_cancelled", () => {
    expect(parseAttentionReason("stop_cancelled")).toEqual({ kind: "stop_cancelled" });
  });
  it("devuelve other para lo desconocido o incompleto", () => {
    expect(parseAttentionReason("insufficient_stock:")).toEqual({ kind: "other", raw: "insufficient_stock:" });
    expect(parseAttentionReason("boom")).toEqual({ kind: "other", raw: "boom" });
  });
});
