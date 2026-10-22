export function buildEvidenceKey(prefix: string, orderId: string, uniqueId: string): string {
  return `${prefix}${orderId}/${uniqueId}.jpg`;
}

export function isEvidenceKeyForOrder(key: string, prefix: string, orderId: string): boolean {
  const orderPrefix = `${prefix}${orderId}/`;
  if (!key.startsWith(orderPrefix)) return false;
  // Un solo segmento .jpg despues del prefijo de la orden: sin subcarpetas ni "..".
  return /^[\w-]+\.jpg$/.test(key.slice(orderPrefix.length));
}
