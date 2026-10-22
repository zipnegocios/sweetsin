import { getDb } from "./db";

export type AssignedOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  deliveryEvidenceKey?: string | null;
};

/** Reemplaza la caché completa (conserva el orden recibido: la más antigua primero). */
export async function replaceAssigned(orders: AssignedOrder[]): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync("DELETE FROM assigned_orders");
    for (const o of orders) {
      await txn.runAsync("INSERT INTO assigned_orders (order_id, payload) VALUES (?, ?)", o.id, JSON.stringify(o));
    }
  });
}

export async function loadAssigned(): Promise<AssignedOrder[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ payload: string }>("SELECT payload FROM assigned_orders ORDER BY rowid ASC");
  return rows.map((r) => JSON.parse(r.payload) as AssignedOrder);
}

export async function clearAssigned(): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM assigned_orders");
}
