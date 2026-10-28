import { NextResponse } from "next/server";
import { DrizzleStockTemplateRepository } from "@workspace/db/repositories";
import { createStockTemplate, listStockTemplates } from "@workspace/domain/stock-templates";
import { authorizeAdmin } from "../_lib/authorize-admin";
import { domainErrorResponse } from "../_lib/domain-error-response";
import { templateBodySchema } from "../_lib/stock-body";

export async function GET(req: Request): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const includeArchived = new URL(req.url).searchParams.get("includeArchived") === "true";
  try {
    return NextResponse.json({ templates: await listStockTemplates(new DrizzleStockTemplateRepository(), includeArchived) });
  } catch (error) {
    return domainErrorResponse(error);
  }
}

export async function POST(req: Request): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;

  const parsed = templateBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const template = await createStockTemplate(new DrizzleStockTemplateRepository(), parsed.data);
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
