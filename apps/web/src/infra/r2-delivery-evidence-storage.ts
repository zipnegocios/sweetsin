import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { DeliveryEvidenceStorage } from "@workspace/domain/orders";
import { createR2Client } from "./r2-client";

// Retencion de las fotos: 7 dias por defecto, ampliable a 30, pendiente de
// confirmacion legal. La regla de ciclo de vida del bucket (expiracion
// automatica) es una tarea de infraestructura aparte, no vive en este codigo.
const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DEFAULT_PREFIX = "delivery-evidence/";

export class EvidenceStorageNotConfiguredError extends Error {
  constructor() {
    super("Delivery evidence storage is not configured yet.");
  }
}

// Se valida al usarse (no al importar) para que el resto de la app funcione sin credenciales.
export function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) throw new EvidenceStorageNotConfiguredError();
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    prefix: process.env.R2_DELIVERY_EVIDENCE_PREFIX || DEFAULT_PREFIX,
  };
}

export class R2DeliveryEvidenceStorage implements DeliveryEvidenceStorage {
  async createUploadUrl(key: string, contentType: "image/jpeg"): Promise<string> {
    const { bucket, ...credentials } = getR2Config();
    const client = createR2Client(credentials);
    return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      // Firma el content-type: el cliente no puede subir otro tipo a la key .jpg.
      signableHeaders: new Set(["content-type"]),
    });
  }
}
