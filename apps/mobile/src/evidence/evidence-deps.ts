import { apiFetch } from "../api/client";
import { rejectAfter } from "../hooks/with-timeout";
import { EVIDENCE_NETWORK_TIMEOUT_MS, EVIDENCE_UPLOAD_TIMEOUT_MS } from "./limits";
import { HttpStatusError, type EvidenceDeps } from "./evidence-upload";

const CONTENT_TYPE = "image/jpeg";

async function expectOk(res: Response): Promise<Response> {
  if (!res.ok) throw new HttpStatusError(res.status);
  return res;
}

/** Red real: endpoints propios con apiFetch; el PUT va directo a la URL prefirmada (sin Authorization). */
export const evidenceDeps: EvidenceDeps = {
  async requestUploadUrl(orderId) {
    const res = await expectOk(
      await rejectAfter(
        apiFetch(`/api/mobile/orders/${encodeURIComponent(orderId)}/evidence/upload-url`, {
          method: "POST",
          body: JSON.stringify({ contentType: CONTENT_TYPE }),
        }),
        EVIDENCE_NETWORK_TIMEOUT_MS,
      ),
    );
    return (await res.json()) as { uploadUrl: string; key: string };
  },
  async putFile(uploadUrl, fileUri) {
    // Un solo plazo para leer el archivo y subirlo; la URL firma la cabecera: debe coincidir exactamente.
    await rejectAfter(
      (async () => {
        const blob = await (await fetch(fileUri)).blob();
        await expectOk(await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": CONTENT_TYPE }, body: blob }));
      })(),
      EVIDENCE_UPLOAD_TIMEOUT_MS,
    );
  },
  async recordEvidence(orderId, evidence) {
    await expectOk(
      await rejectAfter(
        apiFetch(`/api/mobile/orders/${encodeURIComponent(orderId)}/evidence`, {
          method: "POST",
          body: JSON.stringify(evidence),
        }),
        EVIDENCE_NETWORK_TIMEOUT_MS,
      ),
    );
  },
};
