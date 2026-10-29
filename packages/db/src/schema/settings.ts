import { pgTable, integer, boolean, timestamp } from "drizzle-orm/pg-core";

// Fila única de configuración editable — id fijo en 1 por convención (no
// hay multi-tenant ni necesidad de más de una fila). Se agregan columnas
// nuevas acá cuando aparezca la próxima necesidad real de configuración,
// en vez de construir un motor key-value genérico que hoy nadie pidió.
export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  deliveryFeeCents: integer("delivery_fee_cents").notNull().default(500),
  deliveryEvidenceRequired: boolean("delivery_evidence_required").notNull().default(false),
  requireStockConfirmationOnOpen: boolean("require_stock_confirmation_on_open").notNull().default(true),
  allowMultipleActiveStops: boolean("allow_multiple_active_stops").notNull().default(false),
  liveStockEnabled: boolean("live_stock_enabled").notNull().default(true),
  autoSoldOutEnabled: boolean("auto_sold_out_enabled").notNull().default(true),
  timingEnabled: boolean("timing_enabled").notNull().default(true),
  showPerStaffBreakdown: boolean("show_per_staff_breakdown").notNull().default(true),
  capacityEngineEnabled: boolean("capacity_engine_enabled").notNull().default(false),
  workAreaUnits: integer("work_area_units"),
  vehicleCapacityUnits: integer("vehicle_capacity_units"),
  tripMinutes: integer("trip_minutes"),
  maxDeliveryTrips: integer("max_delivery_trips"),
  showEstimateToCustomer: boolean("show_estimate_to_customer").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
