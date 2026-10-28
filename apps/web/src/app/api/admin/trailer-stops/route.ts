import { NextResponse } from "next/server";
import { DrizzleTrailerStopRepository, DrizzleStockRepository } from "@workspace/db/repositories";
import { createTrailerStop, listAllTrailerStops } from "@workspace/domain/trailer-stops";
import { initializeStopStock } from "@workspace/domain/stock";
import { authorizeAdmin } from "../_lib/authorize-admin";
import { domainErrorResponse } from "../_lib/domain-error-response";
import { createStopBodySchema, toStopInput } from "../_lib/trailer-stop-body";

export async function GET(): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  return NextResponse.json({ stops: await listAllTrailerStops(new DrizzleTrailerStopRepository()) });
}

export async function POST(req: Request): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;

  const parsed = createStopBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const stop = await createTrailerStop(new DrizzleTrailerStopRepository(), toStopInput(parsed.data));
    if (parsed.data.products.length > 0) {
      await initializeStopStock(new DrizzleStockRepository(), stop.id, parsed.data.products);
    }
    return NextResponse.json({ stop }, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
