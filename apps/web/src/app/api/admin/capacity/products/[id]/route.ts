import { NextResponse } from "next/server";
import { DrizzleCapacityRepository } from "@workspace/db/repositories";
import { authorizeAdmin } from "../../../_lib/authorize-admin";
import { productRuleBodySchema } from "../../../_lib/capacity-body";
import { domainErrorResponse, isUuid, notFoundResponse } from "../../../_lib/domain-error-response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse("Product not found");
  try {
    const repo = new DrizzleCapacityRepository();
    const [rule, steps] = await Promise.all([repo.getRule(id), repo.listSteps(id)]);
    return NextResponse.json({ rule, steps });
  } catch (error) {
    return domainErrorResponse(error);
  }
}

export async function PUT(req: Request, { params }: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse("Product not found");
  const parsed = productRuleBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  try {
    const repo = new DrizzleCapacityRepository();
    const rule = await repo.saveRule({ productId: id, ...parsed.data.rule });
    const steps = await repo.replaceSteps(id, parsed.data.steps.map((s, i) => ({ ...s, position: i + 1 })));
    return NextResponse.json({ rule, steps });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
