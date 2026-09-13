import { pgTable, integer, timestamp } from "drizzle-orm/pg-core";

// Fila única de configuración editable — id fijo en 1 por convención (no
// hay multi-tenant ni necesidad de más de una fila). Se agregan columnas
// nuevas acá cuando aparezca la próxima necesidad real de configuración,
// en vez de construir un motor key-value genérico que hoy nadie pidió.
export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  deliveryFeeCents: integer("delivery_fee_cents").notNull().default(500),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
