export type StockTemplateErrorKey =
  | "tplErrorGeneric"
  | "tplErrorNameRequired"
  | "tplErrorNameExists"
  | "tplErrorQuantity"
  | "tplErrorDuplicate"
  | "stockErrorBelowSold"
  | "stockErrorNegative"
  | "stockErrorHasMovements"
  | "stockErrorDuplicate"
  | "stockErrorNotFound";

const KEYS: Record<string, StockTemplateErrorKey> = {
  "Template name is required": "tplErrorNameRequired",
  "Template name already exists": "tplErrorNameExists",
  "Quantity must be a positive integer": "tplErrorQuantity",
  "Duplicate product in template": "tplErrorDuplicate",
  "Cannot set stock below units already sold": "stockErrorBelowSold",
  "Current stock would be negative": "stockErrorNegative",
  "Stock row has movements": "stockErrorHasMovements",
  "Product already has stock at this stop": "stockErrorDuplicate",
  "Stock row not found": "stockErrorNotFound",
};

/** Clave i18n (namespace admin) para el mensaje de error devuelto por las acciones. */
export function stockTemplateErrorKey(error: string): StockTemplateErrorKey {
  return KEYS[error] ?? "tplErrorGeneric";
}
