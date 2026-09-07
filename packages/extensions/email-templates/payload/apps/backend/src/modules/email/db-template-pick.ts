/**
 * La DECISIÓN de qué plantilla de base de datos usa un mail, sin la base de datos.
 *
 * Vive fuera de `service.ts` por dos razones y las dos importan:
 *
 *  1. `service.ts` no se puede importar desde un test: arrastra `@medusajs/framework`
 *     y `@sendgrid/mail`. La única forma de probar esta regla ahí era leer el fuente
 *     con `readFileSync` y buscar substrings —lo que hace `site-branding.test.ts`—,
 *     que verifica que el SQL está ESCRITO, no que la precedencia sea la correcta.
 *  2. La regla es puramente de datos: dadas las filas publicadas de una clave y la
 *     tienda del mail, ¿cuál sale? Tenerla mezclada con el I/O es exactamente lo que
 *     dejó pasar el bug que este archivo cierra.
 *
 * EL BUG: el SQL filtraba con `("site_id" = ? OR "site_id" IS NULL)`. Con `siteId`
 * en `null` —los ~10 emisores cuyo evento no lleva ningún eje, el reseteo de
 * contraseña el primero— `"site_id" = NULL` no matchea NADA (en Postgres `x = NULL`
 * no es falso: es NULL), así que sólo entraban las filas GLOBALES. Una plantilla
 * publicada y scopeada a la tienda era INALCANZABLE: el operador la editaba, la
 * publicaba, y el mail seguía saliendo con el texto del código. Sin un solo error.
 *
 * Traer las filas y decidir acá arregla las dos mitades de una sola vez: la
 * precedencia deja de depender de un `OR` que miente, y el caso "hay filas
 * publicadas pero ninguna alcanzable" se vuelve un estado con nombre —`outOfScope`—
 * en vez de ser indistinguible de "no hay plantilla".
 */

/** Lo mínimo que la decisión necesita de una fila de `email_template`. */
export type PublishedTemplateRow = {
  subject: string;
  html: string;
  /** `NULL` = plantilla GLOBAL: el fallback de toda tienda sin la suya. */
  site_id: string | null;
};

export type TemplatePick =
  /** Hay plantilla. `from` es sólo para el log: decir cuál ganó ahorra el diff a mano. */
  | { status: 'template'; subject: string; html: string; from: 'site' | 'global' }
  /** No hay ninguna fila publicada con esa clave. Sale el template del código: normal. */
  | { status: 'none' }
  /**
   * Hay filas publicadas con esa clave y NINGUNA es alcanzable: todas son de otras
   * tiendas y no existe la global. Sale el template del código igual que en `none`,
   * pero NO es lo mismo y por eso es un estado aparte: `none` es la configuración
   * esperada, esto es una plantilla que alguien escribió y publicó para nada.
   *
   * Es el único caso que hay que LOGUEAR. Sin él, el síntoma es "edité la plantilla y
   * sigue saliendo la de antes" y la única forma de diagnosticarlo es leer el SQL y
   * comparar el `site_id` de la fila a mano.
   */
  | { status: 'outOfScope'; siteIds: string[] };

/**
 * Qué plantilla sale, dada la tienda del mail.
 *
 * PRECEDENCIA, no unión: la de la tienda le gana a la global. Al revés no funciona —
 * la global existe casi siempre y taparía a la propia, así que ninguna tienda podría
 * tener texto propio.
 *
 * `siteId === null` (mail sin tienda) sólo puede alcanzar la global, y eso es
 * correcto: no hay tienda de la cual preferir nada. Lo que cambió es que ahora, si
 * hay filas de tiendas y ninguna global, el resultado lo DICE en vez de devolver
 * `none` — ver `implicitSiteId` en `service.ts` para el otro lado del arreglo.
 *
 * Las filas se asumen ordenadas por relevancia (el `ORDER BY` de `loadDbTemplate`
 * pone la de la tienda primero y la global segunda); igual `find` es determinista
 * porque los dos índices únicos parciales del modelo garantizan una sola fila viva
 * por (tienda, clave) y una sola global por clave.
 */
export function pickTemplate(
  rows: readonly PublishedTemplateRow[],
  siteId: string | null,
): TemplatePick {
  if (rows.length === 0) return { status: 'none' };

  if (siteId) {
    const own = rows.find((row) => row.site_id === siteId);
    if (own) {
      return { status: 'template', subject: own.subject, html: own.html, from: 'site' };
    }
  }

  const global = rows.find((row) => row.site_id === null);
  if (global) {
    return { status: 'template', subject: global.subject, html: global.html, from: 'global' };
  }

  return {
    status: 'outOfScope',
    siteIds: [
      ...new Set(rows.map((row) => row.site_id).filter((id): id is string => id !== null)),
    ],
  };
}
