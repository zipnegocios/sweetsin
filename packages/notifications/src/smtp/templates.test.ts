import { describe, it, expect } from "vitest";
import { renderOrderConfirmation, renderEventQuoteReceipt } from "./templates";

describe("renderOrderConfirmation", () => {
  it("renders in English", () => {
    const { subject, text } = renderOrderConfirmation({ id: "order-123", totalCents: 2500 }, "en");
    expect(subject).toContain("Sweet Sin");
    expect(text).toContain("order-123");
    expect(text).toContain("$25.00");
  });

  it("renders in Spanish", () => {
    const { subject, text } = renderOrderConfirmation({ id: "order-123", totalCents: 2500 }, "es");
    expect(subject).toContain("Sweet Sin");
    expect(text).toContain("order-123");
    expect(text).toContain("$25.00");
  });
});

describe("renderEventQuoteReceipt", () => {
  it("renders in English", () => {
    const { subject, text } = renderEventQuoteReceipt({ id: "booking-123" }, "en");
    expect(subject).toContain("Sweet Sin");
    expect(text).toContain("booking-123");
  });

  it("renders in Spanish", () => {
    const { subject, text } = renderEventQuoteReceipt({ id: "booking-123" }, "es");
    expect(subject).toContain("Sweet Sin");
    expect(text).toContain("booking-123");
  });
});
