import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

let dbPromise: Promise<SQLiteDatabase> | null = null;

/** Base local única de la APK; crea las tablas la primera vez. */
export function getDb(): Promise<SQLiteDatabase> {
  dbPromise ??= openDatabaseAsync("sweetsin.db").then(async (db) => {
    await db.execAsync(`
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS deliver_commands (order_id TEXT PRIMARY KEY, created_at INTEGER);
      CREATE TABLE IF NOT EXISTS assigned_orders (order_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    `);
    return db;
  });
  // Si abrir/inicializar falla, el próximo llamado reintenta en vez de repetir el rechazo toda la sesión.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}
