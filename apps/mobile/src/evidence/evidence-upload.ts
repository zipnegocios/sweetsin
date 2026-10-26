export type EvidenceStage = "upload-url" | "upload" | "record";
export type EvidenceResult = { ok: true } | { ok: false; stage: EvidenceStage };

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
  } catch {
    return { ok: false, stage: "upload-url" };
  }
  try {
    await deps.putFile(target.uploadUrl, input.fileUri);
  } catch {
    return { ok: false, stage: "upload" };
  }
  try {
    await deps.recordEvidence(input.orderId, { key: target.key, capturedAt: input.capturedAt, lat: input.lat, lng: input.lng });
  } catch {
    return { ok: false, stage: "record" };
  }
  return { ok: true };
}
