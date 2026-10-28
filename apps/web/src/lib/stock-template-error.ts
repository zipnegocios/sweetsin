export type StockTemplateErrorKey =
  | "tplErrorGeneric"
  | "tplErrorNameRequired"
  | "tplErrorNameExists"
  | "tplErrorQuantity"
  | "tplErrorDuplicate";

const KEYS: Record<string, StockTemplateErrorKey> = {
  "Template name is required": "tplErrorNameRequired",
  "Template name already exists": "tplErrorNameExists",
  "Quantity must be a positive integer": "tplErrorQuantity",
  "Duplicate product in template": "tplErrorDuplicate",
};

/** Clave i18n (namespace admin) para el mensaje de error devuelto por las acciones. */
export function stockTemplateErrorKey(error: string): StockTemplateErrorKey {
  return KEYS[error] ?? "tplErrorGeneric";
}
