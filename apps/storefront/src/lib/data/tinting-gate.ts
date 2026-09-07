/**
 * Qué se muestra del tintómetro en esta tienda, como decisión PURA.
 *
 * Módulo separado de `tinting.ts` a propósito: ese hace I/O (`server-only`,
 * `fetch`, `cache`) y no se puede testear con `node --test`. Acá vive la lógica
 * que se rompió en producción, y `tinting-gate.test.ts` la fija.
 *
 * Distingue DOS cosas que antes eran una sola, y confundirlas fue el bug: que la
 * feature esté PRENDIDA (existe la ruta /colores) no es lo mismo que que haya
 * CARTA cargada (se puede pintar la grilla y el link del menú). Con un solo
 * booleano, una tienda con el switch prendido y la carta vacía devolvía 404 sin
 * una línea de log — y cualquier link a /colores (un hero cargado desde el admin,
 * por ejemplo) caía en not-found sin explicación.
 */

/** Estado de la carta tal como lo reporta `/store/tinting/catalog`. */
export type TintingCatalogState = {
  /** El switch `tinting.enabled` de la config del ERP. */
  enabled: boolean;
  /** Cuántos colores entonables tiene la carta importada. */
  colorCount: number;
  /**
   * El `ready` del backend: hay carta Y hay al menos una base que se puede
   * comprar. NO se re-deriva acá de `colorCount` —que es lo que hacía este
   * módulo— porque tener colores no alcanza: con la carta entera importada y
   * ninguna base dada de alta como producto, cada color termina en "por ahora no
   * tenemos productos en esta tienda". Pasó en producción con 2848 colores.
   */
  ready: boolean;
};

export type TintingGateInput = {
  /**
   * El toggle de la fila del sitio (`tinting_enabled` en /app/sites), o `null`
   * cuando NO SE PUDO LEER la fila. El null importa: ver `resolveTintingGate`.
   */
  siteTinting: boolean | null;
  /** `true` en la tienda principal (sin slug de sitio activo). */
  isMainSite: boolean;
  catalog: TintingCatalogState;
};

/** Por qué está apagado. Se loguea; no se le muestra al cliente final. */
export type TintingOffReason =
  /** La fila del sitio tiene el toggle apagado. */
  | 'site-toggle-off'
  /** No se pudo leer la config del sitio (backend caído, fila no sembrada, 404). */
  | 'site-config-unavailable'
  /** El switch `tinting.enabled` del ERP está apagado. */
  | 'erp-switch-off'
  /** Todo prendido, pero la carta no tiene colores importados. */
  | 'empty-catalog'
  /**
   * Hay carta, pero ninguna base confirmada existe como producto vendible, así
   * que TODOS los colores terminan sin nada que ofrecer. Se separa de
   * `empty-catalog` porque se arregla en otro lado: la carta se importa, las
   * bases se dan de alta con `POST /admin/erp/tinting/bases/sync-products`.
   */
  | 'no-sellable-bases';

export type TintingGate = {
  /** La ruta /colores EXISTE para esta tienda. `false` ⇒ 404. */
  routeEnabled: boolean;
  /** Hay carta: se pinta la grilla y el link del menú. */
  catalogReady: boolean;
  /** `null` cuando está todo bien. */
  reason: TintingOffReason | null;
};

const OFF = (reason: TintingOffReason): TintingGate => ({
  routeEnabled: false,
  catalogReady: false,
  reason,
});

/**
 * Resuelve las dos llaves del tintómetro.
 *
 * REGLA ÚNICA PARA TODAS LAS TIENDAS, principal incluida: la fila del sitio
 * decide si se muestra la vidriera, el ERP decide si hay datos. Antes la
 * principal se saltaba la primera llave (`if (slug)`), así que su toggle en
 * /app/sites no estaba cableado a nada y prenderlo no producía ningún efecto.
 *
 * `siteTinting === null` (no se pudo leer la fila) se trata distinto según la
 * tienda, y no es un capricho:
 *
 *  - En la PRINCIPAL se cae al switch del ERP, que es el comportamiento que tenía
 *    antes de cablear el toggle. La fila principal puede no existir todavía
 *    (`ensureMainStore` no pudo sembrarla porque el store no tiene
 *    `default_sales_channel_id`) y en ese caso no hay ningún lugar donde prender
 *    el toggle: apagar la página ahí sería quitarle una feature que funciona a
 *    cambio de nada.
 *  - En una TIENDA se apaga, igual que antes. Un 404 en
 *    `/store/sites/{slug}/config` significa que el sitio no está `ready`, y ahí ya
 *    no se está sirviendo su branding tampoco.
 */
export const resolveTintingGate = ({
  siteTinting,
  isMainSite,
  catalog,
}: TintingGateInput): TintingGate => {
  if (siteTinting === false) return OFF('site-toggle-off');
  if (siteTinting === null && !isMainSite) return OFF('site-config-unavailable');
  if (!catalog.enabled) return OFF('erp-switch-off');
  // Prendida pero sin carta: la ruta EXISTE (así el link no cae en un 404 mudo) y
  // la página muestra su empty state.
  if (catalog.colorCount <= 0) {
    return { routeEnabled: true, catalogReady: false, reason: 'empty-catalog' };
  }
  // Con carta pero sin una sola base vendible, pintar la grilla es peor que no
  // pintarla: son cientos de swatches que llevan todos al mismo cartel de "no
  // tenemos productos". Mismo tratamiento que la carta vacía —la ruta existe, la
  // página muestra su empty state— y se prende sola cuando entran las bases.
  if (!catalog.ready) {
    return { routeEnabled: true, catalogReady: false, reason: 'no-sellable-bases' };
  }
  return { routeEnabled: true, catalogReady: true, reason: null };
};
