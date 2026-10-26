export type EvidenceStage = "upload-url" | "upload" | "record";
export type EvidenceResult = { ok: true } | { ok: false; stage: EvidenceStage; status?: number };

/** Error HTTP con su código; sin `status` el fallo fue de red o de plazo. */
export class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

const statusOf = (e: unknown): { status?: number } => (e instanceof HttpStatusError ? { status: e.status } : {});

/** Segunda línea del aviso: "<etapa> (<status>)" o la etiqueta de sin conexión. */
export function evidenceFailureDetail(
  failure: { stage: EvidenceStage; status?: number },
  labels: { url: string; upload: string; record: string; offline: string },
): string {
  if (failure.status === undefined) return labels.offline;
  const stage = failure.stage === "upload-url" ? labels.url : failure.stage === "upload" ? labels.upload : labels.record;
  return `${stage} (${failure.status})`;
}

export type EvidenceDeps = {
  requestUploadUrl(orderId: string): Promise<{ uploadUrl: string; key: string }>;
  putFile(uploadUrl: string, fileUri: string): Promise<void>;
  recordEvidence(orderId: string, evidence: { key: string; capturedAt: string; lat: number; lng: number }): Promise<void>;
};

export type EvidenceInput = { orderId: string; fileUri: string; capturedAt: string; lat: number; lng: number };

/** URL prefirmada -> PUT de la foto -> registro de la evidencia; se detiene en la primera etapa que falla. */
export async function runEvidenceUpload(deps: EvidenceDeps, input: EvidenceInput): Promise<EvidenceResult> {
  let target: { uploadUrl: string; key: string };
  try {
    target = await deps.requestUploadUrl(input.orderId);
  } catch (e) {
    return { ok: false, stage: "upload-url", ...statusOf(e) };
  }
  try {
    await deps.putFile(target.uploadUrl, input.fileUri);
  } catch (e) {
    return { ok: false, stage: "upload", ...statusOf(e) };
  }
  try {
    await deps.recordEvidence(input.orderId, { key: target.key, capturedAt: input.capturedAt, lat: input.lat, lng: input.lng });
  } catch (e) {
    return { ok: false, stage: "record", ...statusOf(e) };
  }
  return { ok: true };
}
