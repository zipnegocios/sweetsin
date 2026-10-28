import { S3Client } from "@aws-sdk/client-s3";

export interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function createR2Client({ accountId, accessKeyId, secretAccessKey }: R2Credentials): S3Client {
  return new S3Client({
    region: "auto",
    // R2 rechaza el checksum CRC32 que el SDK nuevo calcula por defecto sobre un body vacio.
    requestChecksumCalculation: "WHEN_REQUIRED",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}
