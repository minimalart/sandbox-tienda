import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { STORE_CONFIG_MODULE } from '../../../modules/store-config';
import type StoreConfigModuleService from '../../../modules/store-config/service';
import { siteIdFromPublishableKey } from '../../../lib/multistore/publishable-key';

/**
 * GET /store/minimum-purchase — public, returns the CURRENTLY effective minimum.
 *
 * "Effective" = starts_at <= now AND (ends_at IS NULL OR ends_at >= now).
 * Among effective records the one with the most recent starts_at wins;
 * ties are broken by created_at DESC (last appended record wins).
 *
 * The date window is evaluated in JS (NOT via MikroORM `$lte`/`$gte` operators):
 * Medusa's auto-generated `list*` methods don't reliably apply comparison
 * operators on `dateTime` fields, so a `{ starts_at: { $lte: now } }` filter
 * silently returns nothing and the storefront falls back to "no minimum". This
 * mirrors the banner module's `resolveBanners`, which filters its date window in
 * JS for the same reason, and keeps the storefront in exact parity with the
 * admin's "Mínimo vigente" computation (`getCurrentMinimumPurchase`).
 *
 * Shape: { minimum_purchase: { amount, currency_code, starts_at, ends_at } | null }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const now = new Date();

    /**
     * El mínimo de MI tienda. Esta ruta listaba las series de TODAS y se quedaba con
     * la más reciente: el monto que el storefront exige para poder comprar salía de la
     * tienda que lo hubiera cambiado último. Es la única fuga de esta auditoría que
     * mueve plata en la dirección equivocada — le pide $50.000 a un cliente al que su
     * tienda le pide $20.000, o al revés, deja pasar carritos por debajo del mínimo.
     *
     * `site_id` sale de la publishable key, igual que en el admin
     * (`admin/store-config/minimum-purchase` ya resuelve con `siteFromRequest`).
     */
    const siteId = await siteIdFromPublishableKey(req);

    // Append-only audit log: fetch the recent history (most recent starts_at
    // first) and pick the first record whose date window contains `now`.
    const records = await service.listMinimumPurchases(
      /*
        La serie de la tienda MÁS la global: una tienda sin serie propia hereda el
        mínimo de la instancia, que es el comportamiento histórico y el que asume todo
        proyecto que nunca tocó la columna.

        OJO CON LA RAMA `siteId === null`, que filtra a la GLOBAL y no a "todo".
        `siteIdFromPublishableKey` devuelve `null` no sólo en un proyecto mono-tienda:
        también cuando la key trae un canal que NINGUNA tienda posee, porque
        `siteFromPublishableKey` usa `allowMainFallback: false` a propósito y eso
        resuelve `allSites`/`registryAbsent`. La política escrita de ese resolver es
        "no filtra — se ve de más, pero se ve lo que ya se veía"; acá sí se filtra.

        El caso que importa es estrecho pero real: multi-tienda configurado, TODAS las
        series cargadas con tienda activa —o sea sin fila global— y una key con canal
        huérfano. La respuesta sale `minimum_purchase: null` y el checkout deja de
        exigir el mínimo, que es plata en la dirección equivocada, justo lo que este
        endpoint existe para evitar.

        No se cambia acá porque las dos salidas son decisiones de negocio y ninguna es
        obviamente correcta: devolver la global (hoy), no filtrar y quedarse con la
        primera vigente de cualquier tienda, o fallar cerrado exigiendo la más alta.
        Queda medido para que se decida a propósito y no por omisión.

        `$or` y no `{ site_id: [siteId, null] }`: la forma de array se emite como
        `site_id IN (..., NULL)` y en SQL eso no matchea un `site_id IS NULL`, así que la
        serie GLOBAL desaparecía justo cuando la key resolvía tienda. Era este endpoint
        devolviendo `null` con el mínimo cargado como global — y el carrito, sin mínimo.
        Ver la nota de `siteColumnFilter`, que tenía el mismo bug.
      */
      siteId
        ? { $or: [{ site_id: siteId }, { site_id: null }] }
        : { site_id: null },
      {
        order: { starts_at: 'DESC', created_at: 'DESC' },
        take: 200,
      },
    );

    const effective = records.filter((record) => {
      const startsAt = record.starts_at ? new Date(record.starts_at) : null;
      const endsAt = record.ends_at ? new Date(record.ends_at) : null;
      return (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
    });

    /**
     * PRECEDENCIA, no unión — y ésta es la parte que el filtro de la query no resuelve
     * por sí solo. Con las dos series mezcladas gana la fila más reciente, así que un
     * cambio del mínimo GLOBAL pisaría el propio de una tienda que lo definió antes.
     * Eso es exactamente el fail-open que documenta `pickBySitePrecedence`: la tienda
     * cree que fijó su monto y opera con el de la instancia sin que nada avise.
     *
     * Por eso primero se busca entre las filas de la tienda; sólo si NO tiene ninguna
     * vigente se cae a la global. `pickBySitePrecedence` no sirve acá porque es para
     * `channel_column` y `minimum_purchase` lleva `site_id`.
     */
    const current =
      (siteId ? effective.find((record) => record.site_id === siteId) : undefined) ??
      effective.find((record) => record.site_id == null) ??
      effective[0] ??
      null;

    return res.status(200).json({
      minimum_purchase: current
        ? {
            amount: current.amount,
            currency_code: current.currency_code,
            starts_at: current.starts_at,
            ends_at: current.ends_at,
          }
        : null,
    });
  } catch (error) {
    console.error('[Store MinimumPurchase] Error fetching current minimum purchase:', error);
    return res.status(200).json({ minimum_purchase: null });
  }
}
