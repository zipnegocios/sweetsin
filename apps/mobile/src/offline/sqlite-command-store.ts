import type { CommandStore } from "./command-queue";
import { getDb } from "./db";

export const sqliteCommandStore: CommandStore = {
  async list() {
    const db = await getDb();
    const rows = await db.getAllAsync<{ order_id: string; created_at: number }>(
      "SELECT order_id, created_at FROM deliver_commands ORDER BY created_at ASC",
    );
    return rows.map((r) => ({ orderId: r.order_id, createdAt: r.created_at }));
  },
  async add(command) {
    const db = await getDb();
    await db.runAsync(
      "INSERT OR IGNORE INTO deliver_commands (order_id, created_at) VALUES (?, ?)",
      command.orderId,
      command.createdAt,
    );
  },
  async remove(orderId) {
    const db = await getDb();
    await db.runAsync("DELETE FROM deliver_commands WHERE order_id = ?", orderId);
  },
};
