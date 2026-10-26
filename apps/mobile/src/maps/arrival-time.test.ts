import { describe, expect, it } from "vitest";
import { formatArrival, routeTiming } from "./arrival-time";

// Fechas locales: el resultado no depende de la zona horaria de la maquina.
const now = new Date(2026, 9, 26, 14, 20, 0);

describe("formatArrival", () => {
  it("suma el ETA a la hora inyectada: 24 h en es, 12 h en en", () => {
    expect(formatArrival(15 * 60, now, "es")).toBe("14:35");
    expect(formatArrival(15 * 60, now, "en")).toBe("2:35 PM");
  });

  it("redondea al minuto mas cercano", () => {
    expect(formatArrival(29, now, "es")).toBe("14:20");
    expect(formatArrival(30, now, "es")).toBe("14:21");
  });

  it("cruza la medianoche y rellena con ceros", () => {
    const late = new Date(2026, 9, 26, 23, 55, 0);
    expect(formatArrival(10 * 60, late, "es")).toBe("00:05");
    expect(formatArrival(10 * 60, late, "en")).toBe("12:05 AM");
  });

  it("mediodia en ingles es 12 PM", () => {
    expect(formatArrival(0, new Date(2026, 9, 26, 12, 7, 0), "en")).toBe("12:07 PM");
  });
});

describe("routeTiming", () => {
  const computedAt = now.toISOString();
  const later = (ms: number) => new Date(now.getTime() + ms);

  it("recien calculada: el ETA completo y no esta desactualizada", () => {
    expect(routeTiming(900, computedAt, now)).toEqual({ remainingSeconds: 900, stale: false });
  });

  it("descuenta el tiempo transcurrido desde computedAt: tiempo restante y hora de llegada coinciden", () => {
    const t = routeTiming(900, computedAt, later(10 * 60_000));
    expect(t).toEqual({ remainingSeconds: 300, stale: true });
    expect(formatArrival(t.remainingSeconds, later(10 * 60_000), "es")).toBe(formatArrival(900, now, "es"));
  });

  it("nunca baja de cero", () => {
    expect(routeTiming(60, computedAt, later(5 * 60_000)).remainingSeconds).toBe(0);
  });

  it("desactualizada solo con mas de 5 minutos", () => {
    expect(routeTiming(900, computedAt, later(5 * 60_000)).stale).toBe(false);
    expect(routeTiming(900, computedAt, later(5 * 60_000 + 1000)).stale).toBe(true);
  });

  it("un reloj del telefono atrasado respecto del servidor no suma tiempo", () => {
    expect(routeTiming(900, computedAt, later(-60_000))).toEqual({ remainingSeconds: 900, stale: false });
  });

  it("sin computedAt valido usa el ETA tal cual", () => {
    expect(routeTiming(900, "", now)).toEqual({ remainingSeconds: 900, stale: false });
  });
});
