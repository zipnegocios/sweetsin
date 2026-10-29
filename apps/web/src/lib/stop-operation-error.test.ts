import { describe, expect, it } from "vitest";
import { stopOperationError } from "./stop-operation-error";

describe("stopOperationError", () => {
  it("traduce 'otra parada activa' por prefijo y conserva el nombre", () => {
    expect(stopOperationError("Another stop is active: Glenelg")).toEqual({
      key: "opErrorAnotherActive",
      values: { location: "Glenelg" },
    });
  });
  it("traduce las reglas de abrir y cerrar", () => {
    expect(stopOperationError("Only scheduled stops can be opened").key).toBe("opErrorNotScheduled");
    expect(stopOperationError("Only active stops can be closed").key).toBe("opErrorNotActiveClose");
    expect(stopOperationError("Stop has undelivered orders").key).toBe("opErrorUndelivered");
    expect(stopOperationError("Stop not found").key).toBe("opErrorStopNotFound");
  });
  it("traduce las reglas de jornadas", () => {
    expect(stopOperationError("A jornada is already open").key).toBe("opErrorJornadaOpen");
    expect(stopOperationError("Only open jornadas can be closed").key).toBe("opErrorNotActiveClose");
  });
  it("traduce las reglas de stock en vivo", () => {
    expect(stopOperationError("Stop is not active").key).toBe("opErrorStopNotActive");
    expect(stopOperationError("Waste exceeds current stock").key).toBe("opErrorWasteExceeds");
    expect(stopOperationError("Live stock is disabled").key).toBe("opErrorLiveStockDisabled");
    expect(stopOperationError("Quantity must be a positive integer").key).toBe("opErrorQuantity");
  });
  it("traduce las reglas de atención de pedidos", () => {
    expect(stopOperationError("Stock still insufficient").key).toBe("opErrorStockInsufficient");
    expect(stopOperationError("Order requires attention").key).toBe("opErrorRequiresAttention");
    expect(stopOperationError("Order does not require attention").key).toBe("opErrorNoAttention");
    expect(stopOperationError("Order has no stop").key).toBe("opErrorNoStop");
    expect(stopOperationError("Only pickup orders can be handed over").key).toBe("opErrorOnlyPickupHandover");
    expect(stopOperationError("Invalid transition: received → delivered").key).toBe("opErrorInvalidTransition");
    expect(stopOperationError("Cannot resolve attention from status: delivered").key).toBe("opErrorInvalidTransition");
  });
  it("usa el genérico para lo desconocido", () => {
    expect(stopOperationError("generic")).toEqual({ key: "opErrorGeneric" });
    expect(stopOperationError("boom")).toEqual({ key: "opErrorGeneric" });
  });
});
