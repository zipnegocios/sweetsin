import { NextResponse } from "next/server";
import { DrizzleStockRepository } from "@workspace/db/repositories";
import { addStopProduct } from "@workspace/domain/stock";
import { authorizeAdmin } from "../../../_lib/authorize-admin";
import { domainErrorResponse } from "../../../_lib/domain-error-response";
import { stopNotFound } from "../../../_lib/require-stop";
import { stockAddBodySchema } from "../../../_lib/stock-body";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    const missing = await stopNotFound(id);
    if (missing) return missing;
    const repo = new DrizzleStockRepository();
    const rows = await repo.listByStop(id);
    const stock = await Promise.all(rows.map(async (r) => ({ ...r, sold: await repo.sumSold(r.id) })));
    return NextResponse.json({ stock });
  } catch (error) {
    return domainErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    const missing = await stopNotFound(id);
    if (missing) return missing;
    const parsed = stockAddBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    const row = await addStopProduct(new DrizzleStockRepository(), id, parsed.data.productId, parsed.data.quantity);
    return NextResponse.json({ stock: row }, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
