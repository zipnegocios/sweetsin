import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { MAX_STAFF_PHOTO_BYTES, removeStaffPhoto, replaceStaffPhoto } from "@workspace/domain/users";
import { isStaffPhotoStorageConfigured, R2StaffPhotoStorage, viewUrlOrNull } from "@/infra/r2-staff-photo-storage";

// La foto pasa por el servidor (la web ya la redimensionó a un JPEG pequeño) para no depender de CORS en el bucket.
type Ctx = { params: Promise<{ id: string }> };

async function guard(): Promise<Response | null> {
  const session = await auth();
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isStaffPhotoStorageConfigured()) {
    return NextResponse.json({ error: "Staff photo storage is not configured yet." }, { status: 503 });
  }
  return null;
}

function failure(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: message.includes("not found") ? 404 : 400 });
}

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await params;

  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (file.size > MAX_STAFF_PHOTO_BYTES) return NextResponse.json({ error: "Photo is too large" }, { status: 413 });

  try {
    const user = await replaceStaffPhoto(
      { users: new DrizzleUserRepository(), photos: new R2StaffPhotoStorage() },
      id,
      new Uint8Array(await file.arrayBuffer()),
    );
    return NextResponse.json({ photoUrl: await viewUrlOrNull(user.photoKey) });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await params;

  try {
    await removeStaffPhoto({ users: new DrizzleUserRepository(), photos: new R2StaffPhotoStorage() }, id);
    return NextResponse.json({ photoUrl: null });
  } catch (error) {
    return failure(error);
  }
}
