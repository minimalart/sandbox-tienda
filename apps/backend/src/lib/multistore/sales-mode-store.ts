import type { MedusaContainer, RemoteQueryFunction } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  DEFAULT_SALES_MODE,
  type SalesMode,
  hiddenProductIds,
  resolveSalesModes,
} from './sales-mode';

/**
 * Acceso a `product_sales_mode` desde el contenedor (PRD Bundles V2 §5, §57).
 *
 * Toda función de este archivo es FAIL-OPEN: si el módulo de tiendas no está
 * registrado, si la tabla todavía no existe o si la query falla, devuelve "no
 * hay nada configurado" y el catálogo se comporta como siempre. Un proyecto
 * sin multitienda tiene que seguir funcionando sin instalar nada (§57-§58), y
 * un error de infraestructura no puede terminar vaciando la vidriera de una
 * tienda.
 */

type SalesModeRow = { product_id: string; sales_mode: string };

const listRows = async (
  container: MedusaContainer,
  siteId: string,
  productIds?: readonly string[],
): Promise<SalesModeRow[]> => {
  try {
    const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(
      ContainerRegistrationKeys.QUERY,
    );
    const filters: Record<string, unknown> = { site_id: siteId };
    if (productIds?.length) filters.product_id = [...productIds];
    const { data } = await query.graph({
      entity: 'product_sales_mode',
      fields: ['product_id', 'sales_mode'],
      filters,
    });
    return (data ?? []) as SalesModeRow[];
  } catch {
    return [];
  }
};

/**
 * Ids de los productos que NO se muestran ni se venden sueltos en esa tienda.
 *
 * Se consulta sólo lo configurado como `bundle_only`, que es un puñado de filas
 * frente al catálogo entero: el filtro del listado es un `$nin` corto, no una
 * lista blanca de todo lo permitido.
 */
export const listHiddenProductIds = async (
  container: MedusaContainer,
  siteId: string | null | undefined,
): Promise<string[]> => {
  if (!siteId) return [];
  return hiddenProductIds(await listRows(container, siteId));
};

/** Modo efectivo de cada producto en una tienda, con el default ya aplicado. */
export const getSalesModes = async (
  container: MedusaContainer,
  siteId: string | null | undefined,
  productIds: readonly string[],
): Promise<Map<string, SalesMode>> => {
  if (!siteId || !productIds.length) {
    return new Map(productIds.map((id) => [id, DEFAULT_SALES_MODE]));
  }
  return resolveSalesModes(productIds, await listRows(container, siteId, productIds));
};

/** Modo de un solo producto. Azúcar sobre `getSalesModes`. */
export const getSalesMode = async (
  container: MedusaContainer,
  siteId: string | null | undefined,
  productId: string,
): Promise<SalesMode> =>
  (await getSalesModes(container, siteId, [productId])).get(productId) ?? DEFAULT_SALES_MODE;

/**
 * Tienda a la que pertenece un carrito, vía su sales channel.
 *
 * Es el eje ESTRICTO: el cart nació con el canal que autorizó la publishable
 * key, así que a diferencia de `?sales_channel_id=` no se puede falsear desde
 * el navegador. Por eso lo usa el guard de add-to-cart y no el resolver de
 * lectura del catálogo.
 */
export const siteIdForCart = async (
  container: MedusaContainer,
  cartId: string,
): Promise<string | null> => {
  try {
    const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(
      ContainerRegistrationKeys.QUERY,
    );
    const { data: carts } = await query.graph({
      entity: 'cart',
      fields: ['id', 'sales_channel_id'],
      filters: { id: cartId },
    });
    const channelId = (carts?.[0] as { sales_channel_id?: string } | undefined)?.sales_channel_id;
    if (!channelId) return null;

    const { data: stores } = await query.graph({
      entity: 'demo_store',
      fields: ['id'],
      filters: { sales_channel_id: channelId },
    });
    return ((stores?.[0] as { id?: string } | undefined)?.id) ?? null;
  } catch {
    return null;
  }
};
