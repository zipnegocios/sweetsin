import { NextResponse } from "next/server";
import { DrizzleStockTemplateRepository } from "@workspace/db/repositories";
import { deleteStockTemplate, getStockTemplate, updateStockTemplate } from "@workspace/domain/stock-templates";
import { authorizeAdmin } from "../../_lib/authorize-admin";
import { domainErrorResponse, isUuid, notFoundResponse } from "../../_lib/domain-error-response";
import { templateBodySchema } from "../../_lib/stock-body";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse("Template not found");
  try {
    return NextResponse.json({ template: await getStockTemplate(new DrizzleStockTemplateRepository(), id) });
  } catch (error) {
    return domainErrorResponse(error);
  }
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse("Template not found");

  const parsed = templateBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const template = await updateStockTemplate(new DrizzleStockTemplateRepository(), id, parsed.data);
    return NextResponse.json({ template });
  } catch (error) {
    return domainErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse("Template not found");
  try {
    await deleteStockTemplate(new DrizzleStockTemplateRepository(), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
