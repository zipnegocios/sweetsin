/** Plazos de la ruta: ninguna llamada puede dejar el mapa cargando para siempre. */
export const ROUTE_LOCATION_TIMEOUT_MS = 15_000;
export const ROUTE_REQUEST_TIMEOUT_MS = 20_000;
/** Lecturas no interactivas (permiso ya concedido, ultima posicion conocida). El dialogo del sistema NO lleva plazo. */
export const ROUTE_LOCATION_LOOKUP_TIMEOUT_MS = 5_000;
