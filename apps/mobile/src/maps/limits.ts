/** Plazos de la ruta: ninguna llamada puede dejar el mapa cargando para siempre. */
export const ROUTE_LOCATION_TIMEOUT_MS = 15_000;
export const ROUTE_REQUEST_TIMEOUT_MS = 20_000;
/** Lecturas no interactivas (permiso ya concedido, ultima posicion conocida). El dialogo del sistema NO lleva plazo. */
export const ROUTE_LOCATION_LOOKUP_TIMEOUT_MS = 5_000;
/** Sin `onMapLoaded` pasado este plazo desde el montaje, el mapa avisa en pantalla (diagnóstico sin adb). */
export const MAP_LOAD_NOTICE_MS = 12_000;
