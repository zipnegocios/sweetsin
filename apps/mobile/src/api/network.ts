// fetch de React Native lanza TypeError ante fallas de red (sin conexion, timeout, DNS).
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}
