import { and, asc, eq, gte, ne } from "drizzle-orm";
import type { TrailerStop, TrailerStopRepository } from "@workspace/domain/trailer-stops";
import { db } from "../index";
import { trailerStopsTable } from "../schema";

export class DrizzleTrailerStopRepository implements TrailerStopRepository {
  async listActive(): Promise<TrailerStop[]> {
    // Filtrar solo por status no alcanza: nada marca una parada como
    // "completed" automáticamente (ese wiring llega recién con el panel
    // admin de Fase 5), así que una parada vencida seguiría con status
    // "scheduled" para siempre. Excluir por endTime evita mostrar en
    // FindUs una ubicación donde el trailer ya no está.
    const now = new Date();
    return db
      .select()
      .from(trailerStopsTable)
      .where(
        and(
          ne(trailerStopsTable.status, "completed"),
          ne(trailerStopsTable.status, "cancelled"),
          gte(trailerStopsTable.endTime, now),
        ),
      )
      .orderBy(asc(trailerStopsTable.startTime));
  }

  async create(stop: Omit<TrailerStop, "id">): Promise<TrailerStop> {
    const [inserted] = await db.insert(trailerStopsTable).values(stop).returning();
    return inserted;
  }

  async findById(id: string): Promise<TrailerStop | null> {
    const [row] = await db.select().from(trailerStopsTable).where(eq(trailerStopsTable.id, id));
    return row ?? null;
  }

  async updateStatus(id: string, status: TrailerStop["status"]): Promise<void> {
    await db.update(trailerStopsTable).set({ status }).where(eq(trailerStopsTable.id, id));
  }
}
