import { describe, it, expect, afterEach, vi } from "vitest";
import { R2StaffPhotoStorage, StaffPhotoStorageNotConfiguredError, viewUrlOrNull } from "./r2-staff-photo-storage";

const VARS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ASSETS_BUCKET", "R2_STAFF_PHOTO_PREFIX"];

afterEach(() => vi.unstubAllEnvs());

describe("R2StaffPhotoStorage", () => {
  it("lanza StaffPhotoStorageNotConfiguredError al usarse sin credenciales R2", async () => {
    for (const name of VARS) vi.stubEnv(name, "");

    await expect(new R2StaffPhotoStorage().createViewUrl("u1/a.jpg")).rejects.toBeInstanceOf(StaffPhotoStorageNotConfiguredError);
    expect(await viewUrlOrNull("u1/a.jpg")).toBeNull();
  });

  it("firma una URL de lectura en sweet-assets con el prefijo de fotos por defecto", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "acct");
    vi.stubEnv("R2_ACCESS_KEY_ID", "ak");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "sk");
    vi.stubEnv("R2_ASSETS_BUCKET", "");
    vi.stubEnv("R2_STAFF_PHOTO_PREFIX", "");

    const url = await new R2StaffPhotoStorage().createViewUrl("u1/a.jpg");

    expect(url).toContain("sweet-assets.acct.r2.cloudflarestorage.com/staff-photos/u1/a.jpg");
    expect(url).toContain("X-Amz-Signature");
  });

  it("viewUrlOrNull devuelve null sin key", async () => {
    expect(await viewUrlOrNull(null)).toBeNull();
  });
});
