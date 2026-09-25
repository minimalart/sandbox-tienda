/**
 * Resolución del mínimo de compra VIGENTE.
 *
 * PURO a propósito: `service.ts` no se puede importar en un test —arrastra
 * `MedusaService` y los modelos de MikroORM, y estos tests corren sin base—, así
 * que la regla vive acá y el service sólo pone la query. Mismo criterio que
 * `lib/whatsapp/advisor/filters.ts`.
 *
 * La comparten TRES consumidores: el storefront (`GET /store/minimum-purchase`),
 * el "Mínimo vigente" del admin y el checkout del bot de WhatsApp. Antes vivía
 * sólo en la ruta pública y el bot generaba el link de pago sin mirarla
 * (DESDEELSUR-72, TC-013).
 */

/** Lo mínimo que esta resolución necesita de una fila de `minimum_purchase`. */
export type MinimumPurchaseRow = {
  amount: number;
  currency_code: string;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  site_id?: string | null;
};

/**
 * Filtro de la query.
 *
 * `$or` Y NO `{ site_id: [siteId, null] }`: la forma de array se emite como
 * `site_id IN (…, NULL)` y en SQL eso NO matchea un `site_id IS NULL`, así que la
 * serie GLOBAL desaparecía justo cuando la key resolvía tienda — el mínimo
 * cargado como global y el carrito sin mínimo. Ver la nota de `siteColumnFilter`,
 * que tenía el mismo bug.
 *
 * OJO con `siteId === null`: filtra a la GLOBAL, no a "todas". El llamador que no
 * pudo resolver tienda recibe el mínimo de la instancia.
 */
export function minimumPurchaseFilter(siteId?: string | null) {
  return siteId ? { $or: [{ site_id: siteId }, { site_id: null }] } : { site_id: null };
}

/**
 * La fila vigente, o `null`.
 *
 * Dos cosas que no son obvias:
 *
 *  1. LA VENTANA DE FECHAS SE EVALÚA EN JS, no en la query. Los `list*`
 *     autogenerados de Medusa no aplican de forma confiable `$lte`/`$gte` sobre
 *     campos `dateTime`: un `{ starts_at: { $lte: now } }` devuelve vacío en
 *     silencio y el llamador concluye "no hay mínimo". Mismo motivo por el que
 *     `resolveBanners` filtra su ventana en JS.
 *
 *  2. PRECEDENCIA, no unión. Con las dos series mezcladas ganaría la fila más
 *     reciente, así que un cambio del mínimo GLOBAL pisaría el propio de una
 *     tienda que lo definió antes: la tienda cree que fijó su monto y opera con
 *     el de la instancia sin que nada avise. Primero se busca entre las filas de
 *     la tienda; sólo si no tiene ninguna vigente se cae a la global.
 *
 * `records` tiene que venir ordenado por `starts_at DESC, created_at DESC`, que
 * es el desempate del historial: la última fila agregada gana.
 */
export function pickEffectiveMinimumPurchase<T extends MinimumPurchaseRow>(
  records: T[],
  siteId?: string | null,
  at: Date = new Date(),
): T | null {
  const effective = records.filter((record) => {
    const startsAt = record.starts_at ? new Date(record.starts_at) : null;
    const endsAt = record.ends_at ? new Date(record.ends_at) : null;
    return (!startsAt || startsAt <= at) && (!endsAt || endsAt >= at);
  });

  return (
    (siteId ? effective.find((record) => record.site_id === siteId) : undefined) ??
    effective.find((record) => record.site_id == null) ??
    effective[0] ??
    null
  );
}

/**
 * Cuánto le falta a un pedido para llegar al mínimo, o `null` si no hay mínimo,
 * si ya lo alcanza o si los montos no son comparables.
 *
 * FALLA ABIERTA con monedas distintas A PROPÓSITO: comparar un mínimo en una
 * moneda contra un subtotal en otra no significa nada, y voltear la venta por un
 * problema de configuración es peor que dejar pasar un pedido corto — que además
 * el checkout del storefront vuelve a validar.
 *
 * Los dos montos van en la unidad MAYOR de la moneda (no en centavos), que es
 * como guarda `minimum_purchase.amount` y como calcula el precio el bot.
 */
export function missingForMinimum(
  minimum: Pick<MinimumPurchaseRow, 'amount' | 'currency_code'> | null,
  subtotal: number,
  currency: string,
): { missing: number; amount: number } | null {
  if (!minimum) return null;
  const amount = Number(minimum.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (String(minimum.currency_code).toLowerCase() !== String(currency).toLowerCase()) return null;
  if (!Number.isFinite(subtotal) || subtotal >= amount) return null;
  return { missing: amount - subtotal, amount };
}
