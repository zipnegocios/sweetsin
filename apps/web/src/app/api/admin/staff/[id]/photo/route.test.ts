import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@workspace/db/repositories", () => ({ DrizzleUserRepository: class {} }));
const replaceStaffPhoto = vi.fn();
const removeStaffPhoto = vi.fn();
vi.mock("@workspace/domain/users", () => ({
  MAX_STAFF_PHOTO_BYTES: 10,
  replaceStaffPhoto: (...a: unknown[]) => replaceStaffPhoto(...a),
  removeStaffPhoto: (...a: unknown[]) => removeStaffPhoto(...a),
}));
const configured = vi.fn();
vi.mock("@/infra/r2-staff-photo-storage", () => ({
  isStaffPhotoStorageConfigured: () => configured(),
  R2StaffPhotoStorage: class {},
  viewUrlOrNull: async (key: string | null) => (key ? `https://signed/${key}` : null),
}));

import { DELETE, POST } from "./route";

const ctx = { params: Promise.resolve({ id: "u1" }) };
const upload = (size: number) => {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(size)], "p.jpg", { type: "image/jpeg" }));
  return new Request("http://x", { method: "POST", body: form });
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { role: "admin" } });
  configured.mockReturnValue(true);
});

describe("/api/admin/staff/[id]/photo", () => {
  it("403 si no es admin", async () => {
    auth.mockResolvedValue({ user: { role: "customer" } });
    expect((await POST(upload(3), ctx)).status).toBe(403);
    expect(replaceStaffPhoto).not.toHaveBeenCalled();
  });

  it("503 si el almacenamiento no está configurado", async () => {
    configured.mockReturnValue(false);
    expect((await POST(upload(3), ctx)).status).toBe(503);
  });

  it("413 si la foto supera el máximo", async () => {
    expect((await POST(upload(11), ctx)).status).toBe(413);
  });

  it("devuelve la URL firmada tras guardar", async () => {
    replaceStaffPhoto.mockResolvedValue({ photoKey: "u1/1.jpg" });
    const res = await POST(upload(3), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ photoUrl: "https://signed/u1/1.jpg" });
  });

  it("traduce los errores del dominio a 400/404", async () => {
    replaceStaffPhoto.mockRejectedValue(new Error("Photo must be a JPEG image"));
    expect((await POST(upload(3), ctx)).status).toBe(400);
    removeStaffPhoto.mockRejectedValue(new Error("User not found: u1"));
    expect((await DELETE(new Request("http://x", { method: "DELETE" }), ctx)).status).toBe(404);
  });

  it("DELETE quita la foto", async () => {
    removeStaffPhoto.mockResolvedValue({});
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), ctx);
    expect(await res.json()).toEqual({ photoUrl: null });
  });
});
