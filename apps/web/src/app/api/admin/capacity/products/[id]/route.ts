import { NextResponse } from "next/server";
import { DrizzleCapacityRepository, DrizzleProductRepository } from "@workspace/db/repositories";
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
    const [rule, steps, modifiedAt] = await Promise.all([repo.getRule(id), repo.listSteps(id), repo.lastModifiedAt()]);
    return NextResponse.json({ rule, steps, lastModifiedAt: modifiedAt?.toISOString() ?? null });
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
    if (!(await new DrizzleProductRepository().findById(id))) return notFoundResponse("Product not found");
    const repo = new DrizzleCapacityRepository();
    const { rule, steps } = await repo.saveRuleWithSteps(
      { productId: id, ...parsed.data.rule },
      parsed.data.steps.map((s, i) => ({ ...s, position: i + 1 })),
    );
    return NextResponse.json({ rule, steps });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
