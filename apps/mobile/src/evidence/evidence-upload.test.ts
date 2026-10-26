import { describe, expect, it, vi } from "vitest";
import { evidenceFailureDetail, HttpStatusError, runEvidenceUpload } from "./evidence-upload";

const input = { orderId: "o1", fileUri: "file:///p.jpg", capturedAt: "2026-10-21T10:00:00.000Z", lat: -33.8, lng: 151.2 };

function makeDeps() {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      requestUploadUrl: vi.fn(async () => {
        calls.push("url");
        return { uploadUrl: "https://r2/put", key: "k1" };
      }),
      putFile: vi.fn(async () => {
        calls.push("put");
      }),
      recordEvidence: vi.fn(async () => {
        calls.push("record");
      }),
    },
  };
}

describe("runEvidenceUpload", () => {
  it("camino feliz: las tres en orden con los datos correctos", async () => {
    const { deps, calls } = makeDeps();
    expect(await runEvidenceUpload(deps, input)).toEqual({ ok: true });
    expect(calls).toEqual(["url", "put", "record"]);
    expect(deps.putFile).toHaveBeenCalledWith("https://r2/put", "file:///p.jpg");
    expect(deps.recordEvidence).toHaveBeenCalledWith("o1", { key: "k1", capturedAt: input.capturedAt, lat: -33.8, lng: 151.2 });
  });

  it("falla requestUploadUrl: stage upload-url y no sigue", async () => {
    const { deps } = makeDeps();
    deps.requestUploadUrl.mockRejectedValueOnce(new Error("x"));
    expect(await runEvidenceUpload(deps, input)).toEqual({ ok: false, stage: "upload-url" });
    expect(deps.putFile).not.toHaveBeenCalled();
    expect(deps.recordEvidence).not.toHaveBeenCalled();
  });

  it("falla putFile: stage upload y no registra", async () => {
    const { deps } = makeDeps();
    deps.putFile.mockRejectedValueOnce(new Error("x"));
    expect(await runEvidenceUpload(deps, input)).toEqual({ ok: false, stage: "upload" });
    expect(deps.recordEvidence).not.toHaveBeenCalled();
  });

  it("falla recordEvidence: stage record", async () => {
    const { deps } = makeDeps();
    deps.recordEvidence.mockRejectedValueOnce(new Error("x"));
    expect(await runEvidenceUpload(deps, input)).toEqual({ ok: false, stage: "record" });
  });

  it("conserva el status HTTP de cada etapa", async () => {
    const a = makeDeps();
    a.deps.requestUploadUrl.mockRejectedValueOnce(new HttpStatusError(503));
    expect(await runEvidenceUpload(a.deps, input)).toEqual({ ok: false, stage: "upload-url", status: 503 });
    const b = makeDeps();
    b.deps.putFile.mockRejectedValueOnce(new HttpStatusError(403));
    expect(await runEvidenceUpload(b.deps, input)).toEqual({ ok: false, stage: "upload", status: 403 });
    const c = makeDeps();
    c.deps.recordEvidence.mockRejectedValueOnce(new HttpStatusError(409));
    expect(await runEvidenceUpload(c.deps, input)).toEqual({ ok: false, stage: "record", status: 409 });
  });
});

describe("evidenceFailureDetail", () => {
  const labels = { url: "pedir URL", upload: "subir foto", record: "registrar", offline: "sin conexión" };
  it("arma etapa + status", () => {
    expect(evidenceFailureDetail({ stage: "upload-url", status: 503 }, labels)).toBe("pedir URL (503)");
    expect(evidenceFailureDetail({ stage: "upload", status: 403 }, labels)).toBe("subir foto (403)");
    expect(evidenceFailureDetail({ stage: "record", status: 409 }, labels)).toBe("registrar (409)");
  });
  it("sin status es sin conexión", () => {
    expect(evidenceFailureDetail({ stage: "upload" }, labels)).toBe("sin conexión");
  });
});
