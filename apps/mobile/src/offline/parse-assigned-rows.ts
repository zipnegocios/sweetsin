/** Parsea cada fila de la caché; una fila corrupta se omite en vez de romper el fallback offline. */
export function parseAssignedRows<T>(rows: { payload: string }[]): T[] {
  const parsed: T[] = [];
  for (const r of rows) {
    try {
      parsed.push(JSON.parse(r.payload) as T);
    } catch {
      // fila corrupta: se omite
    }
  }
  return parsed;
}
