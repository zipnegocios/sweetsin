import { POST as trailerStopRestock } from "../../../../../trailer-stops/[id]/stock/[productId]/restock/route";
import { findJornada } from "@/lib/jornadas";
import { authorizeAdmin } from "../../../../../_lib/authorize-admin";
import { notFoundResponse } from "../../../../../_lib/domain-error-response";

type Ctx = { params: Promise<{ id: string; productId: string }> };

// Misma lógica que en las paradas (liveStockEnabled, jornada abierta, fila existente); solo agrega que sea una jornada.
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!(await findJornada(id))) return notFoundResponse();
  return trailerStopRestock(req, ctx);
}
