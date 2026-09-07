import { slugify } from './slug';

/**
 * Clasificación PURA de las marcas del ERP (testeable sin container).
 *
 * El ERP trae la marca como TEXTO LIBRE por artículo. Acá se decide qué
 * entidades `brand` hay que crear (una por handle slugificado) y qué links
 * producto↔marca hay que agregar o sacar.
 *
 * La identidad es el HANDLE, no el nombre: dos escrituras del mismo nombre
 * ("Winsor & Newton" / "Winsor  &  Newton") colapsan en una sola marca. Eso es
 * dedupe deseado; para que el resultado sea determinístico corrida a corrida,
 * cuando varios nombres comparten handle se elige el primero alfabéticamente.
 */

export type BrandArticleStatus = 'linked' | 'unchanged' | 'no_brand' | 'no_product';

export type BrandPlan = {
  /** Marcas a crear, deduplicadas por handle. */
  creates: Array<{ name: string; handle: string }>;
  /** handle → productIds a linkear (todavía no tienen ese link). */
  links: Map<string, string[]>;
  /** Ids de `product_product_brand_brand` a soft-deletear (el producto cambió de marca). */
  unlinkIds: string[];
  unchanged: number;
  no_brand: number;
  no_product: number;
  perArticle: Map<string, { status: BrandArticleStatus; handle?: string }>;
};

export function planBrandAssignments(input: {
  rows: Array<{ code: string; brand: string | null }>;
  productsByCode: Map<string, { product_id: string }>;
  /** handle → brand_id de las marcas que ya existen. */
  existingBrandIdByHandle: Map<string, string>;
  /** product_id → links actuales. */
  existingLinksByProduct: Map<string, Array<{ id: string; brand_id: string }>>;
  /** La marca del ERP reemplaza el set de marcas del producto. Default true. */
  replaceExisting?: boolean;
}): BrandPlan {
  const {
    rows,
    productsByCode,
    existingBrandIdByHandle,
    existingLinksByProduct,
  } = input;
  const replaceExisting = input.replaceExisting ?? true;

  const plan: BrandPlan = {
    creates: [],
    links: new Map(),
    unlinkIds: [],
    unchanged: 0,
    no_brand: 0,
    no_product: 0,
    perArticle: new Map(),
  };

  // Nombre canónico por handle: el primero alfabéticamente, para que dos
  // corridas con el mismo catálogo creen la marca con el mismo nombre.
  const nameByHandle = new Map<string, string>();
  for (const row of rows) {
    const name = row.brand?.trim();
    if (!name) continue;
    const handle = slugify(name);
    if (!handle) continue;
    const current = nameByHandle.get(handle);
    if (!current || name.localeCompare(current) < 0) nameByHandle.set(handle, name);
  }

  for (const [handle, name] of nameByHandle) {
    if (!existingBrandIdByHandle.has(handle)) plan.creates.push({ name, handle });
  }
  plan.creates.sort((a, b) => a.handle.localeCompare(b.handle));

  for (const row of rows) {
    const name = row.brand?.trim();
    const handle = name ? slugify(name) : '';
    if (!handle) {
      plan.no_brand++;
      plan.perArticle.set(row.code, { status: 'no_brand' });
      continue;
    }

    const product = productsByCode.get(row.code);
    if (!product) {
      plan.no_product++;
      plan.perArticle.set(row.code, { status: 'no_product', handle });
      continue;
    }

    const brandId = existingBrandIdByHandle.get(handle) ?? null;
    const links = existingLinksByProduct.get(product.product_id) ?? [];
    // Si la marca todavía no existe (está en `creates`), el link no puede estar.
    const hasTarget = brandId !== null && links.some((link) => link.brand_id === brandId);
    const stale = replaceExisting
      ? links.filter((link) => link.brand_id !== brandId).map((link) => link.id)
      : [];

    if (hasTarget && !stale.length) {
      plan.unchanged++;
      plan.perArticle.set(row.code, { status: 'unchanged', handle });
      continue;
    }

    if (!hasTarget) {
      const list = plan.links.get(handle);
      if (list) {
        if (!list.includes(product.product_id)) list.push(product.product_id);
      } else {
        plan.links.set(handle, [product.product_id]);
      }
    }
    plan.unlinkIds.push(...stale);
    plan.perArticle.set(row.code, { status: 'linked', handle });
  }

  // Un mismo link puede aparecer por dos artículos del mismo producto.
  plan.unlinkIds = Array.from(new Set(plan.unlinkIds));
  return plan;
}
