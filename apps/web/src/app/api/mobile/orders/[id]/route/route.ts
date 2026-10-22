import { NextResponse } from "next/server";
import { getRouteForOrder } from "@workspace/domain/routing";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { CachingRoutePlanner } from "@/infra/caching-route-planner";
import { GoogleRoutesPlanner, RoutesNotConfiguredError } from "@/infra/google-routes-planner";
import { requireMobileAuth } from "../../../_lib/require-mobile-auth";

// Singleton de modulo: la cache persiste entre requests dentro del mismo proceso.
const planner = new CachingRoutePlanner(new GoogleRoutesPlanner(), { ttlMs: 60_000 });

function parseCoordinate(raw: string | null, min: number, max: number): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw);
  return n >= min && n <= max ? n : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "delivery") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const url = new URL(req.url);
  const lat = parseCoordinate(url.searchParams.get("lat"), -90, 90);
  const lng = parseCoordinate(url.searchParams.get("lng"), -180, 180);
  if (lat === null || lng === null) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const route = await getRouteForOrder(
      { orders: new DrizzleOrderRepository(), planner },
      id,
      { userId: session.userId, role: "delivery" },
      { lat, lng },
    );
    return NextResponse.json({ ...route, computedAt: route.computedAt.toISOString() });
  } catch (error) {
    if (error instanceof RoutesNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    // Reglas de dominio y "sin ruta" (RouteNotFoundError): 404 si la orden no existe, 409 en el resto.
    const message = error instanceof Error ? error.message : "Conflict";
    const status = message.startsWith("Order not found") ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
