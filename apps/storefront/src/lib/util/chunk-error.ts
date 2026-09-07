/**
 * Detección y auto-recuperación de errores de carga de chunks.
 *
 * EL CASO QUE ESTO RESUELVE: una pestaña abierta con el bundle de un deploy viejo
 * navega por `<Link>` a una ruta cuyo chunk todavía no había bajado. Ese chunk ya no
 * existe en el CDN (build nuevo, hashes nuevos), el import dinámico rechaza y —sin
 * error boundary— Next reemplaza el documento entero por su página de error en inglés.
 * El usuario ve una pantalla blanca que "se arregla recargando", que es exactamente lo
 * que el error boundary hace acá solo.
 *
 * Módulo NEUTRO (sin `"use client"`): lo importan `error.tsx` y `global-error.tsx`,
 * que ya son client components.
 */

/**
 * Los mensajes varían por bundler y por browser, y ninguno es estable entre versiones,
 * así que se matchea por patrón sobre `name + message` en vez de comparar strings.
 */
const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk \S+ failed/i,
  /Loading CSS chunk/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
];

/** `true` si el error es un chunk/módulo que no se pudo bajar. */
export const isChunkLoadError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  const haystack = `${typeof name === "string" ? name : ""} ${
    typeof message === "string" ? message : ""
  }`;
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(haystack));
};

const RELOAD_AT_KEY = "mc:chunk-reload-at";
/**
 * Si el chunk sigue faltando INMEDIATAMENTE después de recargar, el problema no es
 * skew de deploy (CDN roto, red del usuario, extensión que bloquea el asset) y seguir
 * recargando dejaría la pantalla parpadeando para siempre. Pasada la ventana sí se
 * vuelve a permitir: un deploy más tarde, en la misma pestaña, merece su recuperación.
 */
const LOOP_WINDOW_MS = 10_000;

/**
 * Recarga la página si el error es de chunk. Devuelve `true` cuando disparó la recarga,
 * para que el llamador NO siga renderizando ni reporte el error como si fuera un bug.
 */
export const recoverFromChunkLoadError = (error: unknown): boolean => {
  if (typeof window === "undefined") return false;
  if (!isChunkLoadError(error)) return false;

  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_AT_KEY)) || 0;
    if (last && Date.now() - last < LOOP_WINDOW_MS) return false;
    window.sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
  } catch {
    // sessionStorage bloqueado (modo privado, cookies de terceros): sin guard no se
    // recarga. Es preferible mostrar el error a arriesgar un loop infinito.
    return false;
  }

  window.location.reload();
  return true;
};
