import type { MedusaContainer } from '@medusajs/framework/types';
import { truncateError } from '../sanitize';
import type { BrandPlan } from './plan-brand-assignments';

/**
 * Lado de ESCRITURA de las marcas del ERP contra la extensión Marcas.
 *
 * El módulo `brand` se resuelve POR NOMBRE y es OPCIONAL: importar
 * `modules/brand` desde `modules/erp` rompería el extractor de extensiones (un
 * mismo archivo con dos dueños) y dejaría al ERP sin arrancar en proyectos que
 * no instalaron Marcas. Sin la extensión, el sync igual escribe
 * `product.metadata.brand`, así que el filtro del storefront sigue andando.
 */

const BRAND_LINK_CHUNK = 500;
const BRAND_PAGE_SIZE = 1000;

/** Superficie del módulo de marcas que usa el sync. */
export type BrandWriter = {
  listBrands(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<Array<{ id: string; handle: string; name: string }>>;
  createBrands(
    data: Array<{ name: string; handle: string; is_active?: boolean; metadata?: Record<string, unknown> }>
  ): Promise<Array<{ id: string; handle: string }>>;
  listProductBrandLinks(
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<Array<{ id: string; product_id: string; brand_id: string }>>;
  createProductBrandLinks(data: Array<{ product_id: string; brand_id: string }>): Promise<unknown>;
  softDeleteProductBrandLinks(ids: string[]): Promise<unknown>;
};

/** `null` si la extensión de marcas no está instalada en este proyecto. */
export function resolveBrandWriter(container: MedusaContainer): BrandWriter | null {
  try {
    return container.resolve('brand') as unknown as BrandWriter;
  } catch {
    return null;
  }
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

export async function readBrandState(
  brands: BrandWriter,
  productIds: string[]
): Promise<{
  brandIdByHandle: Map<string, string>;
  linksByProduct: Map<string, Array<{ id: string; brand_id: string }>>;
}> {
  const brandIdByHandle = new Map<string, string>();
  for (let skip = 0; ; skip += BRAND_PAGE_SIZE) {
    const page = await brands.listBrands(
      {},
      { select: ['id', 'handle'], take: BRAND_PAGE_SIZE, skip }
    );
    for (const brand of page) brandIdByHandle.set(brand.handle, brand.id);
    if (page.length < BRAND_PAGE_SIZE) break;
  }

  const linksByProduct = new Map<string, Array<{ id: string; brand_id: string }>>();
  for (const batch of chunk(productIds, BRAND_LINK_CHUNK)) {
    const links = await brands.listProductBrandLinks({ product_id: batch }, { take: null });
    for (const link of links) {
      const list = linksByProduct.get(link.product_id);
      if (list) list.push(link);
      else linksByProduct.set(link.product_id, [link]);
    }
  }

  return { brandIdByHandle, linksByProduct };
}

export type BrandApplyResult = {
  brandsCreated: number;
  linksAdded: number;
  linksRemoved: number;
  errors: string[];
};

export async function applyBrandAssignments(
  brands: BrandWriter,
  plan: BrandPlan,
  brandIdByHandle: Map<string, string>,
  provider: string
): Promise<BrandApplyResult> {
  const result: BrandApplyResult = {
    brandsCreated: 0,
    linksAdded: 0,
    linksRemoved: 0,
    errors: [],
  };

  // ── Altas de marca: las 125 del catálogo entran en una sola llamada ────────
  // Sin logo: el artículo del ERP no trae imagen de marca; se cargan a mano
  // desde el admin de Marcas. `sales_channel_ids` queda null = todos los canales.
  if (plan.creates.length) {
    try {
      const created = await brands.createBrands(
        plan.creates.map((brand) => ({
          name: brand.name,
          handle: brand.handle,
          is_active: true,
          metadata: { erp_source: provider },
        }))
      );
      for (const brand of created ?? []) brandIdByHandle.set(brand.handle, brand.id);
      result.brandsCreated = (created ?? []).length;
    } catch (error) {
      result.errors.push(`No se pudieron crear marcas del ERP: ${truncateError(error)}`);
    }
  }

  // ── Unlinks primero: un producto que cambia de marca no queda en las dos ───
  for (const batch of chunk(plan.unlinkIds, BRAND_LINK_CHUNK)) {
    try {
      await brands.softDeleteProductBrandLinks(batch);
      result.linksRemoved += batch.length;
    } catch (error) {
      result.errors.push(`No se pudieron quitar ${batch.length} marca(s): ${truncateError(error)}`);
    }
  }

  // ── Links nuevos ───────────────────────────────────────────────────────────
  const pending: Array<{ product_id: string; brand_id: string }> = [];
  for (const [handle, productIds] of plan.links) {
    const brandId = brandIdByHandle.get(handle);
    if (!brandId) {
      result.errors.push(`La marca "${handle}" no existe en Medusa: ${productIds.length} producto(s) sin marca.`);
      continue;
    }
    for (const productId of productIds) pending.push({ product_id: productId, brand_id: brandId });
  }
  for (const batch of chunk(pending, BRAND_LINK_CHUNK)) {
    try {
      await brands.createProductBrandLinks(batch);
      result.linksAdded += batch.length;
    } catch (error) {
      result.errors.push(`No se pudieron asignar ${batch.length} marca(s): ${truncateError(error)}`);
    }
  }

  return result;
}
