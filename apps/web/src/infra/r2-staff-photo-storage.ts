import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StaffPhotoStorage } from "@workspace/domain/users";
import { createR2Client } from "./r2-client";

const VIEW_URL_TTL_SECONDS = 60 * 60;
const DEFAULT_BUCKET = "sweet-assets";
const DEFAULT_PREFIX = "staff-photos/";

export class StaffPhotoStorageNotConfiguredError extends Error {
  constructor() {
    super("Staff photo storage is not configured yet.");
  }
}

// Se valida al usarse (no al importar) para que el resto de la app funcione sin credenciales.
// Comparte credenciales con la evidencia de entrega, pero usa el bucket de assets de la plataforma.
function getConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) throw new StaffPhotoStorageNotConfiguredError();
  return {
    credentials: { accountId, accessKeyId, secretAccessKey },
    bucket: process.env.R2_ASSETS_BUCKET || DEFAULT_BUCKET,
    prefix: process.env.R2_STAFF_PHOTO_PREFIX || DEFAULT_PREFIX,
  };
}

export function isStaffPhotoStorageConfigured(): boolean {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}

export class R2StaffPhotoStorage implements StaffPhotoStorage {
  async put(key: string, body: Uint8Array, contentType: "image/jpeg"): Promise<void> {
    const { credentials, bucket, prefix } = getConfig();
    await createR2Client(credentials).send(
      new PutObjectCommand({ Bucket: bucket, Key: prefix + key, Body: body, ContentType: contentType }),
    );
  }

  async delete(key: string): Promise<void> {
    const { credentials, bucket, prefix } = getConfig();
    await createR2Client(credentials).send(new DeleteObjectCommand({ Bucket: bucket, Key: prefix + key }));
  }

  async createViewUrl(key: string): Promise<string> {
    const { credentials, bucket, prefix } = getConfig();
    return getSignedUrl(createR2Client(credentials), new GetObjectCommand({ Bucket: bucket, Key: prefix + key }), {
      expiresIn: VIEW_URL_TTL_SECONDS,
    });
  }
}

/** URL firmada o null: una foto que no se puede firmar nunca debe romper la pantalla ni el login. */
export async function viewUrlOrNull(photoKey: string | null | undefined): Promise<string | null> {
  if (!photoKey || !isStaffPhotoStorageConfigured()) return null;
  try {
    return await new R2StaffPhotoStorage().createViewUrl(photoKey);
  } catch {
    return null;
  }
}
