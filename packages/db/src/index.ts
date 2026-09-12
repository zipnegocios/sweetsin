import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// La conexión real (y la validación de DATABASE_URL) se crea recién en el
// primer uso, no al importar el módulo. Next.js importa este archivo
// durante "Collecting page data" en cada build (incluso para páginas
// force-dynamic, que no ejecutan sus queries hasta runtime) — validar acá
// arriba rompía el build de Docker en cualquier entorno donde
// DATABASE_URL solo esté disponible en runtime, no en build-time.
function createPool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

function createLazyProxy<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  const getInstance = (): T => {
    if (!instance) instance = factory();
    return instance;
  };

  return new Proxy({} as T, {
    get(_target, prop, _receiver) {
      const real = getInstance();
      const value = Reflect.get(real as object, prop, real);
      return typeof value === "function" ? value.bind(real) : value;
    },
  });
}

let _pool: pg.Pool | undefined;
function getPool(): pg.Pool {
  if (!_pool) _pool = createPool();
  return _pool;
}

export const pool: pg.Pool = createLazyProxy(getPool);
export const db = createLazyProxy(() => drizzle(getPool(), { schema }));

export * from "./schema";
