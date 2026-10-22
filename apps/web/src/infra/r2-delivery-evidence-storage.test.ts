import { describe, it, expect, afterEach, vi } from "vitest";
import { EvidenceStorageNotConfiguredError, R2DeliveryEvidenceStorage } from "./r2-delivery-evidence-storage";

const VARS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_DELIVERY_EVIDENCE_PREFIX"];

afterEach(() => vi.unstubAllEnvs());

describe("R2DeliveryEvidenceStorage", () => {
  it("lanza EvidenceStorageNotConfiguredError al usarse sin variables R2", async () => {
    for (const name of VARS) vi.stubEnv(name, "");

    await expect(new R2DeliveryEvidenceStorage().createUploadUrl("k.jpg", "image/jpeg")).rejects.toBeInstanceOf(
      EvidenceStorageNotConfiguredError,
    );
  });

  it("devuelve una URL prefirmada para el bucket y la key configurados", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "acct");
    vi.stubEnv("R2_ACCESS_KEY_ID", "ak");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "sk");
    vi.stubEnv("R2_BUCKET", "bucket");

    const url = await new R2DeliveryEvidenceStorage().createUploadUrl("delivery-evidence/o1/u1.jpg", "image/jpeg");

    expect(url).toContain("acct.r2.cloudflarestorage.com");
    expect(url).toContain("delivery-evidence/o1/u1.jpg");
    expect(url).toContain("X-Amz-Signature");
    // El content-type debe quedar firmado y no debe haber checksum (R2 lo rechaza con el body real).
    const params = new URL(url).searchParams;
    expect(params.get("X-Amz-SignedHeaders")).toContain("content-type");
    expect(params.has("x-amz-checksum-crc32")).toBe(false);
  });
});
