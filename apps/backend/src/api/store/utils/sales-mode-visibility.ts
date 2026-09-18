import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { listHiddenProductIds, getSalesMode, siteIdForCart } from '../../../lib/multistore/sales-mode-store';
import { isSellableStandalone } from '../../../lib/multistore/sales-mode';
import { resolveActiveBundleStore } from '../bundles/resolve-store';

/**
 * Visibilidad de productos `bundle_only` en las rutas de storefront
 * (PRD Bundles V2 §8, §9, §46, §48).
 *
 * Son DOS middlewares con ejes distintos a propósito:
 *
 *  - Lectura del catálogo (`/store/products`): el eje es el mismo que usa todo
 *    el contenido scopeado del storefront, `?sales_channel_id=`. Alcanza porque
 *    lo peor que puede hacer un cliente que lo falsea es VER un producto de
 *    otra tienda, que es el mismo trade-off ya documentado en `resolve-store`.
 *
 *  - Escritura (`POST /store/carts/:id/line-items`): el eje es el CARRITO, que
 *    nació con el canal que autorizó la publishable key y no se puede falsear.
 *    Ocultar en el front no alcanza: la protección de verdad es esta (§9).
 *
 * El workflow de bundles NO pasa por acá: llama a `addToCartWorkflow`
 * directamente, así que la excepción para los productos `bundle_only` ocurre
 * dentro del flujo validado y no hace falta ningún parámetro tipo
 * `allow_bundle_only` que el navegador podría mandar solo.
 */

type FilterCarrier = {
  filterableFields?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

/**
 * Saca del listado los productos ocultos en la tienda activa.
 *
 * Respeta un filtro de ids existente (el PDP por handle, el enriquecimiento del
 * wizard, los relacionados) restándole los ocultos en vez de pisarlo: si se
 * reemplazara por un `$nin` suelto, una consulta por ids devolvería catálogo de
 * más.
 */
export const hideBundleOnlyProducts = () => {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction,
  ): Promise<void> => {
    try {
      const store = await resolveActiveBundleStore(req);
      if (!store.scoped) return next();

      const hidden = await listHiddenProductIds(req.scope, store.storeId);
      if (!hidden.length) return next();

      const carrier = req as unknown as FilterCarrier;
      const fields = (carrier.filterableFields ??= {});
      const hiddenSet = new Set(hidden);

      const requestedId = fields.id;
      if (typeof requestedId === 'string') {
        // Detalle por id: si está oculto, que no exista para esta tienda.
        if (hiddenSet.has(requestedId)) fields.id = '__bundle_only_hidden__';
      } else if (Array.isArray(requestedId)) {
        const allowed = requestedId.filter((id) => !hiddenSet.has(String(id)));
        // Lista vacía = "ningún id": se deja un id imposible para no
        // degradar en "traer todo".
        fields.id = allowed.length ? allowed : ['__bundle_only_hidden__'];
      } else {
        fields.id = { $nin: hidden };
      }
    } catch {
      /* Fail-open: un error de resolución no puede vaciar la vidriera. */
    }
    return next();
  };
};

/**
 * Rechaza agregar al carrito un producto que en esa tienda sólo se vende dentro
 * de un kit. El mensaje es deliberadamente parco: quien llega acá es un cliente
 * que se salteó la UI.
 */
export const rejectBundleOnlyLineItem = () => {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction,
  ): Promise<void> => {
    try {
      const body = (req.body ?? {}) as { variant_id?: string };
      const cartId = (req.params as Record<string, string> | undefined)?.id;
      if (!body.variant_id || !cartId) return next();

      const siteId = await siteIdForCart(req.scope, cartId);
      if (!siteId) return next();

      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
        graph: (args: unknown) => Promise<{ data?: Array<{ product_id?: string }> }>;
      };
      const { data } = await query.graph({
        entity: 'variant',
        fields: ['id', 'product_id'],
        filters: { id: body.variant_id },
      });
      const productId = data?.[0]?.product_id;
      if (!productId) return next();

      const mode = await getSalesMode(req.scope, siteId, productId);
      if (!isSellableStandalone(mode)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          'Este producto solo se vende como parte de un kit.',
        );
      }
    } catch (error) {
      // El rechazo propio sí sube; cualquier otra falla deja pasar (fail-open):
      // el guard es una red de seguridad, no un punto único de caída del
      // add-to-cart.
      if (MedusaError.isMedusaError(error) && error.type === MedusaError.Types.NOT_ALLOWED) {
        return next(error);
      }
    }
    return next();
  };
};
