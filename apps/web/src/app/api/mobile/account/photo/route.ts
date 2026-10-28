import { NextResponse } from "next/server";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { MAX_STAFF_PHOTO_BYTES, removeStaffPhoto, replaceStaffPhoto } from "@workspace/domain/users";
import { isStaffPhotoStorageConfigured, R2StaffPhotoStorage, viewUrlOrNull } from "@/infra/r2-staff-photo-storage";
import { authorizeMobile } from "../../_lib/authorize-mobile";

// El propio staff cambia su foto (cámara de la app). Mismo almacén y reglas que el admin; solo toca al usuario de la sesión.
async function guard(req: Request) {
  const session = await authorizeMobile(req);
  if (session instanceof Response) return session;
  if (!isStaffPhotoStorageConfigured()) {
    return NextResponse.json({ error: "Staff photo storage is not configured yet." }, { status: 503 });
  }
  return session;
}

const deps = () => ({ users: new DrizzleUserRepository(), photos: new R2StaffPhotoStorage() });

export async function POST(req: Request): Promise<Response> {
  const session = await guard(req);
  if (session instanceof Response) return session;

  // El cuerpo es el JPEG tal cual (la app no puede subir multipart por uri con el fetch de Expo).
  const jpeg = new Uint8Array(await req.arrayBuffer());
  if (jpeg.length === 0) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (jpeg.length > MAX_STAFF_PHOTO_BYTES) return NextResponse.json({ error: "Photo is too large" }, { status: 413 });

  try {
    const user = await replaceStaffPhoto(deps(), session.userId, jpeg);
    return NextResponse.json({ photoUrl: await viewUrlOrNull(user.photoKey) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const session = await guard(req);
  if (session instanceof Response) return session;
  await removeStaffPhoto(deps(), session.userId);
  return NextResponse.json({ photoUrl: null });
}
