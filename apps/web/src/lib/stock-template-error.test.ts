import { describe, expect, it } from "vitest";
import { stockTemplateErrorKey } from "./stock-template-error";

describe("stockTemplateErrorKey", () => {
  it("traduce los mensajes de negocio conocidos", () => {
    expect(stockTemplateErrorKey("Template name already exists")).toBe("tplErrorNameExists");
    expect(stockTemplateErrorKey("Duplicate product in template")).toBe("tplErrorDuplicate");
  });
  it("traduce las reglas de stock de la parada", () => {
    expect(stockTemplateErrorKey("Cannot set stock below units already sold")).toBe("stockErrorBelowSold");
    expect(stockTemplateErrorKey("Stock row has movements")).toBe("stockErrorHasMovements");
    expect(stockTemplateErrorKey("Product already has stock at this stop")).toBe("stockErrorDuplicate");
    expect(stockTemplateErrorKey("Stock row not found")).toBe("stockErrorNotFound");
    expect(stockTemplateErrorKey("Quantity must be a positive integer")).toBe("tplErrorQuantity");
  });
  it("usa el genérico para lo desconocido", () => {
    expect(stockTemplateErrorKey("generic")).toBe("tplErrorGeneric");
    expect(stockTemplateErrorKey("boom")).toBe("tplErrorGeneric");
  });
});
