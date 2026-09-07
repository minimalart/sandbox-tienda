/**
 * Lo poco que comparten la pantalla principal y la sub-página de configuración
 * desde que los ajustes dejaron de ser una pestaña. Se hizo un módulo en vez de
 * copiar las dos líneas en cada archivo porque `errorMessage` es lo que decide
 * qué ve el operador cuando la API rechaza algo: dos copias driftean y una de
 * las pantallas termina mostrando "[object Object]".
 *
 * Precedente del patrón en el repo: `routes/recurring-orders/helpers.ts`.
 */

/** Las rutas de gift-card-experience devuelven formas muy distintas por endpoint. */
export type Design = Record<string, any>;

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'No se pudo completar la operación.';
