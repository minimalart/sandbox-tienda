import type { SiteResolution } from './types';

/**
 * Quién puede escribir QUÉ `site_id`, decidido sin container y sin excepciones.
 *
 * `scope.ts` ya sabe qué filas puede LEER y EDITAR un operador (`siteFilter`,
 * `assertIdInSite`). Lo que faltaba es la otra mitad: cuando el body trae `site_id`,
 * ese campo no es un dato más — es la MUDANZA de la fila entre tiendas, y decide a
 * quién le cambia el texto del mail.
 *
 * Está en un archivo aparte y sin `import` de `@medusajs` a propósito. `scope.ts`
 * importa `MedusaError` y por eso no se puede cargar en un test; la regla de quién
 * puede escribir qué es exactamente la que hay que probar con casos, no con un regex
 * sobre el fuente. Acá se decide, en `scope.ts` (`assertWritableSiteId`) se tira.
 */

/** Qué se le permite hacer al pedido, y si no, por qué no. */
export type SiteWriteVerdict =
  /**
   * Permitido. `patch` es lo que hay que escribir: `{}` cuando el pedido no toca el
   * eje (el body no trajo el campo, o trajo el valor que la fila ya tiene), así que el
   * call site lo puede spreadear sin condicionales — igual que `siteDefaults`.
   */
  | { ok: true; patch: Record<string, string | null> }
  /** Prohibido. `code` es estable para el cliente; `message` es para el operador. */
  | { ok: false; code: SiteWriteDenial; message: string };

export type SiteWriteDenial =
  /** Pidió escribir la fila de OTRA tienda desde la pantalla de la suya. */
  | 'cross-site'
  /** Pidió convertir en GLOBAL desde la pantalla de una tienda. */
  | 'globalize'
  /** Pidió adueñarse de la fila GLOBAL desde la pantalla de una tienda. */
  | 'adopt-global'
  /** La tienda elegida en la request no existe o fue borrada. */
  | 'unknown-site';

export type SiteIdWriteRequest = {
  /** Columna de tienda de la tabla (`site_id` en todas las de hoy). */
  column: string;
  /**
   * Lo que vino en el body. `undefined` = el body NO trajo el campo (no se toca el
   * eje); `null` = GLOBAL explícito. La distinción es la razón por la que el validator
   * lo declara `.nullable().optional()` y no sólo `.optional()`.
   */
  requested: string | null | undefined;
  /**
   * El `site_id` que la fila tiene HOY. `undefined` en un alta (no hay fila todavía).
   *
   * Hace falta para distinguir un no-op de una mudanza: un PATCH que reenvía el
   * `site_id` que la fila ya tenía —lo que hace cualquier formulario que mande el
   * objeto completo— no puede rebotar.
   */
  current?: string | null;
};

/**
 * La regla, en una frase: **con una tienda activa sólo se escribe esa tienda.**
 *
 * Por qué tan cerrada. Las rutas de `email-templates` ya dejan a un operador con la
 * tienda A ABIERTA editar la plantilla GLOBAL —el descriptor es `empty: 'all'` y
 * `assertIdInSite` la incluye—, y eso es deliberado: si no la viera, vería salir un
 * mail con un texto que no aparece en ninguna parte de su backoffice. Pero editar el
 * TEXTO de la global y MUDAR una fila entre tiendas no son la misma operación:
 *
 *  - `null` desde la tienda A (`globalize`) le cambia el mail a TODAS las tiendas que
 *    no tienen la suya. El operador de A no tiene forma de saber a quiénes.
 *  - `demo_b` desde la tienda A (`cross-site`) le escribe la plantilla a B. Es
 *    exactamente la escritura cruzada que `assertIdInSite` cierra por el lado del id.
 *  - `demo_a` sobre la fila que hoy es global (`adopt-global`) es la más traicionera:
 *    parece que A "se queda con la global", pero lo que hace es SACARLA de todas las
 *    demás, que se quedan sin plantilla y vuelven al texto del código en silencio.
 *
 * Las tres se permiten con el selector en "Todas las tiendas" (`allSites`), que es el
 * contexto donde el operador está mirando la instancia entera y puede ver el efecto.
 * Es también el contexto que destraba el caso real: con el selector en todas, poner
 * `site_id: null` en la plantilla de `password-reset` la vuelve global y recién ahí el
 * subscriber del reseteo —que no puede declarar tienda— la alcanza.
 *
 * `singleSite` y `registryAbsent` también son libres: con una sola tienda (o sin
 * registro) no hay a quién cruzarle nada. Es el mismo fail-open del resto del seam.
 *
 * `unknownSite` se DENIEGA en vez de degradar. Es la regla del archivo hermano
 * (`assertResolved` en `scope.ts`): colapsar un id stale en "sin tienda" es cómo una
 * escritura termina siendo global creyendo estar scopeada.
 */
export function decideSiteIdWrite(
  resolution: SiteResolution,
  request: SiteIdWriteRequest,
): SiteWriteVerdict {
  const { column, requested, current } = request;

  if (resolution.status === 'unknownSite') {
    return {
      ok: false,
      code: 'unknown-site',
      message: 'La tienda seleccionada no existe o fue eliminada.',
    };
  }

  // El body no trajo el campo: no se toca el eje. Distinto de `null`, que SÍ lo toca.
  if (requested === undefined) return { ok: true, patch: {} };

  // Sin tienda activa no hay a quién cruzarle nada: `allSites`, `singleSite`,
  // `registryAbsent`. Ver la nota de arriba sobre por qué es el contexto correcto para
  // convertir en global.
  if (resolution.status !== 'site') {
    return { ok: true, patch: { [column]: requested } };
  }

  const active = resolution.site.id;

  // No-op: reenviar el valor que la fila ya tiene. Un formulario que manda el objeto
  // completo hace esto en cada guardado y no puede rebotar.
  if (current !== undefined && requested === current) {
    return { ok: true, patch: {} };
  }

  if (requested === null) {
    return {
      ok: false,
      code: 'globalize',
      message:
        `Convertir esta fila en global le cambia el contenido a TODAS las tiendas que no ` +
        `tengan la suya, y desde la tienda "${active}" no hay forma de ver a cuáles. ` +
        `Hacelo con el selector de tienda en "Todas las tiendas".`,
    };
  }

  if (requested !== active) {
    return {
      ok: false,
      code: 'cross-site',
      message:
        `No se puede escribir la fila de la tienda "${requested}" desde la tienda "${active}".`,
    };
  }

  // `requested === active` y la fila hoy es global: no es "quedarse con la global", es
  // sacársela a todas las demás, que vuelven al fallback sin ninguna señal.
  if (current === null) {
    return {
      ok: false,
      code: 'adopt-global',
      message:
        `Esta fila hoy es GLOBAL: asignarla a la tienda "${active}" se la QUITA a todas las ` +
        `demás, que se quedan sin contenido para esa clave. Si querés una propia, duplicala ` +
        `desde la tienda "${active}" en vez de mudar la global.`,
    };
  }

  return { ok: true, patch: { [column]: requested } };
}
