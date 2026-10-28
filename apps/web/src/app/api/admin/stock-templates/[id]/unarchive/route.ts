import { NextResponse } from "next/server";
import { DrizzleStockTemplateRepository } from "@workspace/db/repositories";
import { unarchiveStockTemplate } from "@workspace/domain/stock-templates";
import { authorizeAdmin } from "../../../_lib/authorize-admin";
import { domainErrorResponse, isUuid, notFoundResponse } from "../../../_lib/domain-error-response";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse("Template not found");
  try {
    await unarchiveStockTemplate(new DrizzleStockTemplateRepository(), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
