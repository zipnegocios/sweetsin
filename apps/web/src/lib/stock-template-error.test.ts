import { describe, expect, it } from "vitest";
import { stockTemplateErrorKey } from "./stock-template-error";

describe("stockTemplateErrorKey", () => {
  it("traduce los mensajes de negocio conocidos", () => {
    expect(stockTemplateErrorKey("Template name already exists")).toBe("tplErrorNameExists");
    expect(stockTemplateErrorKey("Duplicate product in template")).toBe("tplErrorDuplicate");
  });
  it("usa el genérico para lo desconocido", () => {
    expect(stockTemplateErrorKey("generic")).toBe("tplErrorGeneric");
    expect(stockTemplateErrorKey("boom")).toBe("tplErrorGeneric");
  });
});
