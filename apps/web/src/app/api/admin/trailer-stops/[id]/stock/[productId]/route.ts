import { NextResponse } from "next/server";
import { DrizzleStockRepository } from "@workspace/db/repositories";
import { removeStopProduct, setStopProductQuantity } from "@workspace/domain/stock";
import { authorizeAdmin } from "../../../../_lib/authorize-admin";
import { domainErrorResponse, isUuid, notFoundResponse } from "../../../../_lib/domain-error-response";
import { stopNotFound } from "../../../../_lib/require-stop";
import { stockQuantityBodySchema } from "../../../../_lib/stock-body";

type Ctx = { params: Promise<{ id: string; productId: string }> };

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id, productId } = await params;
  if (!isUuid(productId)) return notFoundResponse("Stock row not found");
  try {
    const missing = await stopNotFound(id);
    if (missing) return missing;
    const parsed = stockQuantityBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    const row = await setStopProductQuantity(new DrizzleStockRepository(), id, productId, parsed.data.quantity);
    return NextResponse.json({ stock: row });
  } catch (error) {
    return domainErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id, productId } = await params;
  if (!isUuid(productId)) return notFoundResponse("Stock row not found");
  try {
    const missing = await stopNotFound(id);
    if (missing) return missing;
    await removeStopProduct(new DrizzleStockRepository(), id, productId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
