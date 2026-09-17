import type { MedusaRequest } from '@medusajs/framework/http';
import type { RemoteQueryFunction } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { siteFromPublishableKey } from '../../../lib/multistore/publishable-key';

/**
 * Resolve the active Store id for a storefront bundle request.
 *
 * Axis (mismo patrón que blog / banners / marcas / videos / looks / sucursales /
 * pdf-catalog / payment-benefits / recomendaciones — 9 rutas ya declaradas
 * `pending` en `store-routes.ts`): el CLIENTE declara en qué tienda está vía
 * `?sales_channel_id=`. El storefront lo lee de `tenant.medusa.salesChannelId`
 * (que ya emite el endpoint `/store/sites/:slug/config`).
 *
 * Por qué NO sólo publishable key:
 *   `siteFromPublishableKey` sirve cuando la pk mapea a UNA tienda. En el
 *   boilerplate real las pks habilitan N sales channels a la vez (ej. la
 *   `Api Key Mati` del deploy actual está linkeada a main + marianista +
 *   otras 2 demos). Cuando eso pasa el resolver toma el `[0]` de la lista y
 *   siempre resuelve a la misma tienda, así que un bundle linkeado a
 *   marianista devuelve 404 desde la propia storefront de marianista.
 *
 * Trade-off conocido (declarado en el JSDoc de `store-routes.ts`):
 *   Con este patrón un cliente podría pedir `?sales_channel_id=<otro>` y ver
 *   bundles de otra tienda (fuga obvia). Es el mismo modo de falla que
 *   dominan las 9 rutas `pending`. La alternativa hoy es NO filtrar y ver
 *   TODO — peor. Cuando exista pk exclusiva por tenant se puede subir a
 *   `scoped` estricto sin cambio de contrato del storefront.
 *
 * Confirm / reconfigure NO usan este helper: su eje sigue siendo el cart
 * (`cart.sales_channel_id`), que es más estricto porque el cart nació con
 * el canal autorizado por la pk y no se puede spoofear.
 */
export const resolveActiveBundleStore = async (
  req: MedusaRequest,
): Promise<{ scoped: true; storeId: string } | { scoped: false }> => {
  const carrier = req as unknown as {
    query?: { sales_channel_id?: string | string[] };
    filterableFields?: { sales_channel_id?: string | string[] };
  };
  const requested =
    pickFirstString(carrier.filterableFields?.sales_channel_id) ??
    pickFirstString(carrier.query?.sales_channel_id);

  // Path 1: sales_channel_id explícito (highest priority — patrón de contenido
  // scopeado del storefront). Se resuelve el demo_store cuyo sales_channel_id
  // sea exactamente ese. Si no matchea (canal huérfano de tenant), degrada a
  // `scoped: false` para no ocultar en silencio.
  if (requested) {
    try {
      const query = req.scope.resolve<Omit<RemoteQueryFunction, symbol>>(
        ContainerRegistrationKeys.QUERY,
      );
      const { data } = await query.graph({
        entity: 'demo_store',
        fields: ['id', 'sales_channel_id'],
        filters: { sales_channel_id: requested },
      });
      const storeId = (data?.[0] as { id?: string } | undefined)?.id;
      if (storeId) return { scoped: true, storeId };
    } catch {
      /* demo_store not registered → fall through to publishable key path */
    }
  }

  // Path 2: publishable key con exactamente una tienda (fallback compatible
  // con el diseño original — funciona el día que la pk sea exclusiva del
  // tenant).
  try {
    const resolution = await siteFromPublishableKey(req);
    if (resolution.status === 'site' || resolution.status === 'singleSite') {
      return { scoped: true, storeId: resolution.site.id };
    }
    return { scoped: false };
  } catch {
    return { scoped: false };
  }
};

function pickFirstString(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === 'string' && v.length > 0);
    return first ?? null;
  }
  return null;
}
