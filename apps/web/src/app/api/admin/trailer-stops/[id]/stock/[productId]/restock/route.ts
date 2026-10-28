import { NextResponse } from "next/server";
import { DrizzleStockRepository, DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { restockStopProduct } from "@workspace/domain/stock";
import { assertLiveStockEnabled } from "@/lib/live-stock";
import { authorizeAdminUser } from "../../../../../_lib/authorize-admin";
import { domainErrorResponse, isUuid, notFoundResponse } from "../../../../../_lib/domain-error-response";
import { stockMovementBodySchema } from "../../../../../_lib/stock-body";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; productId: string }> },
): Promise<Response> {
  const admin = await authorizeAdminUser();
  if (admin instanceof Response) return admin;
  const { id, productId } = await params;
  if (!isUuid(id)) return notFoundResponse();
  if (!isUuid(productId)) return notFoundResponse("Stock row not found");
  const parsed = stockMovementBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  try {
    await assertLiveStockEnabled();
    await restockStopProduct(
      { stops: new DrizzleTrailerStopRepository(), stock: new DrizzleStockRepository() },
      id,
      productId,
      parsed.data.quantity,
      admin.userId,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
