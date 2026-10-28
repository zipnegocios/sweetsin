const KEYS: Record<string, string> = {
  "Template name is required": "tplErrorNameRequired",
  "Template name already exists": "tplErrorNameExists",
  "Quantity must be a positive integer": "tplErrorQuantity",
  "Duplicate product in template": "tplErrorDuplicate",
};

/** Clave i18n (namespace admin) para el mensaje de error devuelto por las acciones. */
export function stockTemplateErrorKey(error: string): string {
  return KEYS[error] ?? "tplErrorGeneric";
}
