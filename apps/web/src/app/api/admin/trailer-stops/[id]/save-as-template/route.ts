import { NextResponse } from "next/server";
import { DrizzleStockRepository, DrizzleStockTemplateRepository } from "@workspace/db/repositories";
import { saveStopStockAsTemplate } from "@workspace/domain/stock";
import { authorizeAdmin } from "../../../_lib/authorize-admin";
import { domainErrorResponse } from "../../../_lib/domain-error-response";
import { stopNotFound } from "../../../_lib/require-stop";
import { saveTemplateBodySchema } from "../../../_lib/stock-body";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    const missing = await stopNotFound(id);
    if (missing) return missing;
    const parsed = saveTemplateBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    const template = await saveStopStockAsTemplate(
      new DrizzleStockRepository(),
      new DrizzleStockTemplateRepository(),
      id,
      parsed.data.name,
    );
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
