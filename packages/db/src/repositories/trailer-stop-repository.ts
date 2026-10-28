import { and, asc, count, eq, gte, inArray, ne } from "drizzle-orm";
import type { NewTrailerStop, TrailerStop, TrailerStopRepository } from "@workspace/domain/trailer-stops";
import { db } from "../index";
import { ordersTable, stockEventsTable, stopProductStockTable, trailerStopsTable } from "../schema";

const stopColumns = {
  id: trailerStopsTable.id,
  location: trailerStopsTable.location,
  lat: trailerStopsTable.lat,
  lng: trailerStopsTable.lng,
  startTime: trailerStopsTable.startTime,
  endTime: trailerStopsTable.endTime,
  status: trailerStopsTable.status,
  originalLocation: trailerStopsTable.originalLocation,
  originalLat: trailerStopsTable.originalLat,
  originalLng: trailerStopsTable.originalLng,
  originalStartTime: trailerStopsTable.originalStartTime,
  originalEndTime: trailerStopsTable.originalEndTime,
};

export class DrizzleTrailerStopRepository implements TrailerStopRepository {
  async listVisible(): Promise<TrailerStop[]> {
    // Filtrar solo por status no alcanza: nada marca una parada como
    // "completed" automáticamente, así que una parada vencida seguiría con
    // status "scheduled" para siempre. Excluir por endTime evita mostrar una
    // ubicación donde el trailer ya no está. Las canceladas futuras sí se
    // muestran (con aviso) hasta que vence su horario.
    return db
      .select(stopColumns)
      .from(trailerStopsTable)
      .where(and(ne(trailerStopsTable.status, "completed"), gte(trailerStopsTable.endTime, new Date())))
      .orderBy(asc(trailerStopsTable.startTime));
  }

  async listAll(): Promise<TrailerStop[]> {
    return db.select(stopColumns).from(trailerStopsTable).orderBy(asc(trailerStopsTable.startTime));
  }

  async create(stop: NewTrailerStop): Promise<TrailerStop> {
    const [inserted] = await db.insert(trailerStopsTable).values(stop).returning(stopColumns);
    return inserted;
  }

  async findById(id: string): Promise<TrailerStop | null> {
    const [row] = await db.select(stopColumns).from(trailerStopsTable).where(eq(trailerStopsTable.id, id));
    return row ?? null;
  }

  async updateStatus(id: string, status: TrailerStop["status"]): Promise<void> {
    await db.update(trailerStopsTable).set({ status }).where(eq(trailerStopsTable.id, id));
  }

  async update(id: string, patch: Partial<Omit<TrailerStop, "id">>): Promise<void> {
    await db.update(trailerStopsTable).set(patch).where(eq(trailerStopsTable.id, id));
  }

  async countOrders(id: string): Promise<number> {
    const [row] = await db.select({ n: count() }).from(ordersTable).where(eq(ordersTable.stopId, id));
    return row?.n ?? 0;
  }

  async deleteWithStock(id: string): Promise<void> {
    // Sin catch: una violación de FK (pedido creado en paralelo) debe propagarse.
    await db.transaction(async (tx) => {
      const stocks = await tx
        .select({ id: stopProductStockTable.id })
        .from(stopProductStockTable)
        .where(eq(stopProductStockTable.stopId, id));
      const stockIds = stocks.map((s) => s.id);
      if (stockIds.length > 0) {
        await tx.delete(stockEventsTable).where(inArray(stockEventsTable.stopProductStockId, stockIds));
        await tx.delete(stopProductStockTable).where(eq(stopProductStockTable.stopId, id));
      }
      await tx.delete(trailerStopsTable).where(eq(trailerStopsTable.id, id));
    });
  }
}
