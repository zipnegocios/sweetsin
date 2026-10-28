"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { StaffAvatar } from "./staff-avatar";

const PHOTO_SIZE = 600;

// Recorta al centro en cuadrado y exporta JPEG: normaliza el formato, aplica la orientación EXIF y deja el archivo en decenas de KB.
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PHOTO_SIZE;
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85),
  );
}

export function StaffPhotoUploader({ userId, name, initialUrl }: { userId: string; name: string; initialUrl: string | null }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(request: () => Promise<Response>) {
    setBusy(true);
    setError("");
    try {
      const res = await request();
      if (!res.ok) {
        setError(res.status === 503 ? t("staffPhotoNotConfigured") : t("staffPhotoError"));
        return;
      }
      setPhotoUrl((await res.json()).photoUrl);
      router.refresh();
    } catch {
      setError(t("staffPhotoError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    let blob: Blob;
    try {
      blob = await toSquareJpeg(file);
    } catch {
      setError(t("staffPhotoError"));
      return;
    }
    const form = new FormData();
    form.set("file", blob, "photo.jpg");
    await send(() => fetch(`/api/admin/staff/${userId}/photo`, { method: "POST", body: form }));
    if (inputRef.current) inputRef.current.value = "";
  }

  const label = photoUrl ? t("staffPhotoChange") : t("staffPhotoUpload");

  return (
    <div className="flex flex-wrap items-center gap-6">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={label}
        className="group relative rounded-full transition duration-200 hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sin-red/30 disabled:opacity-70"
      >
        <StaffAvatar name={name} photoUrl={photoUrl} size="xl" />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-navy/55 text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? t("staffPhotoUploading") : label}
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />

      <div className="space-y-2">
        <p className="max-w-xs text-[13px] text-navy/55">{t("staffPhotoHint")}</p>
        <div className="flex gap-4 text-sm">
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="admin-link disabled:opacity-50">
            {label}
          </button>
          {photoUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={() => send(() => fetch(`/api/admin/staff/${userId}/photo`, { method: "DELETE" }))}
              className="text-sin-red-dark/80 hover:text-sin-red hover:underline disabled:opacity-50"
            >
              {t("staffPhotoRemove")}
            </button>
          )}
        </div>
        {error && <p role="alert" className="text-[13px] text-sin-red">{error}</p>}
      </div>
    </div>
  );
}
