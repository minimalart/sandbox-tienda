/**
 * Persist normalized products into Medusa, scoped to a demo's sales channel.
 */
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  deleteProductsWorkflow,
  linkProductsToSalesChannelWorkflow,
} from '@medusajs/core-flows';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { NormalizedProduct } from './catalog/types';
import { slugify } from './catalog/util';
import { buildPersistProductPlan, type ProductPlanItem } from './persist-plan';
export { buildPersistProductPlan, isLikelyBarcode, skuForProduct } from './persist-plan';

const PRODUCT_BATCH = 100;

export type PersistProgress = {
  total: number;
  imported: number;
  failed: number;
  skipped: number;
  linked: number;
};

export type PersistOptions = {
  salesChannelId: string;
  currencyCode: string;
  products: NormalizedProduct[];
  /**
   * When true (default), products already in THIS sales channel that the import
   * brings again are deleted and recreated, so they pick up the latest shape
   * (e.g. real size variants instead of the legacy single "Único"). Products
   * shared with another sales channel are left untouched to avoid affecting
   * other demos. Set false to keep the old "skip existing, only link" behavior.
   */
  recreateExisting?: boolean;
  onProgress?: (p: PersistProgress) => Promise<void> | void;
};

export type PersistResult = {
  created: number;
  failed: number;
  skipped: number;
  skippedReasons: Record<string, number>;
  /** Pre-existing products (same handle) linked into this demo's sales channel. */
  linkedExisting: number;
  /** Existing products deleted so the import could recreate them with fresh data. */
  recreated: number;
  linkedBrands: number;
  categories: number;
  /** Sampled failure messages (batch + per-product), surfaced in error_log. */
  errors: string[];
};

type CatRow = { id: string; name: string; parent_category_id: string | null; handle: string };

const catKey = (parentId: string | null, name: string) => `${parentId ?? 'root'}::${name}`;

function resolveParentId(
  product: NormalizedProduct,
  depth: number,
  catMap: Map<string, string>,
): string | null {
  let parentId: string | null = null;
  for (let level = 0; level <= depth; level++) {
    const id: string | null = catMap.get(catKey(parentId, product.categoryPath[level]!)) ?? null;
    if (!id) return null;
    parentId = id;
  }
  return parentId;
}

export async function persistProducts(
  container: any,
  opts: PersistOptions,
): Promise<PersistResult> {
  const { salesChannelId, currencyCode, products, onProgress } = opts;
  const recreateExisting = opts.recreateExisting ?? true;
  const productService: any = container.resolve(Modules.PRODUCT);
  const brandService: any = container.resolve('brand');

  // Memory: page categories instead of an arbitrary take ceiling. We only keep
  // the lightweight catMap (key→id) and the set of used handles, dropping each
  // page of rows.
  const PAGE = 1000;
  const catMap = new Map<string, string>();
  const usedHandles = new Set<string>();
  for (let offset = 0; ; offset += PAGE) {
    const catPage: CatRow[] = await productService.listProductCategories(
      {},
      { select: ['id', 'name', 'parent_category_id', 'handle'], take: PAGE, skip: offset },
    );
    for (const category of catPage) {
      catMap.set(catKey(category.parent_category_id, category.name), category.id);
      usedHandles.add(category.handle);
    }
    if (catPage.length < PAGE) break;
  }

  const uniqueHandle = (base: string): string => {
    let handle = base || 'cat';
    let index = 2;
    while (usedHandles.has(handle)) handle = `${base}-${index++}`;
    usedHandles.add(handle);
    return handle;
  };

  const maxDepth = products.reduce((max, product) => Math.max(max, product.categoryPath.length), 0);
  for (let level = 0; level < maxDepth; level++) {
    const toCreate = new Map<
      string,
      { name: string; parent_category_id: string | null; handle: string }
    >();
    for (const product of products) {
      if (product.categoryPath.length <= level) continue;
      const name = product.categoryPath[level]!;
      const parentId = level === 0 ? null : resolveParentId(product, level - 1, catMap);
      if (level > 0 && !parentId) continue;
      const key = catKey(parentId, name);
      if (catMap.has(key) || toCreate.has(key)) continue;
      const handle = uniqueHandle(slugify(product.categoryPath.slice(0, level + 1).join(' ')));
      toCreate.set(key, { name, parent_category_id: parentId, handle });
    }
    if (toCreate.size === 0) continue;
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: Array.from(toCreate.values()).map((category) => ({
          name: category.name,
          handle: category.handle,
          is_active: true,
          parent_category_id: category.parent_category_id ?? undefined,
        })),
      },
    });
    for (const created of result as CatRow[]) {
      catMap.set(catKey(created.parent_category_id ?? null, created.name), created.id);
    }
  }

  const leafCategoryId = (product: NormalizedProduct): string | null => {
    let parentId: string | null = null;
    let id: string | null = null;
    for (const name of product.categoryPath) {
      id = catMap.get(catKey(parentId, name)) ?? null;
      if (!id) return null;
      parentId = id;
    }
    return id;
  };

  const brandNames = Array.from(
    new Set(products.map((product) => product.brand).filter((brand): brand is string => !!brand)),
  );
  // Memory: page brands and keep only the handle→id map, dropping each page.
  const brandByHandle = new Map<string, string>();
  for (let offset = 0; ; offset += PAGE) {
    const brandPage: Array<{ id: string; handle: string }> = await brandService.listBrands(
      {},
      { select: ['id', 'handle'], take: PAGE, skip: offset },
    );
    for (const brand of brandPage) brandByHandle.set(brand.handle, brand.id);
    if (brandPage.length < PAGE) break;
  }
  const uniqueNewBrands = Array.from(
    new Map(
      brandNames
        .map((name) => ({ name, handle: slugify(name) }))
        .filter((brand) => brand.handle && !brandByHandle.has(brand.handle))
        .map((brand) => [brand.handle, brand]),
    ).values(),
  );
  if (uniqueNewBrands.length > 0) {
    const created = await brandService.createBrands(uniqueNewBrands);
    for (const brand of created as Array<{ id: string; handle: string }>) {
      brandByHandle.set(brand.handle, brand.id);
    }
  }
  const brandIdFor = (name: string | null): string | null =>
    name ? brandByHandle.get(slugify(name)) ?? null : null;

  // Existing products keyed by handle, plus which ones are already in THIS demo's
  // sales channel. The product↔sales_channel link isn't a direct FK, so we resolve
  // it via query.graph (same approach as the list endpoint). This lets us link a
  // pre-existing product (created by another demo or a previous partial run) into
  // this channel instead of skipping it — so a re-import completes the catalog.
  const handleToId = new Map<string, string>();
  const idToHandle = new Map<string, string>();
  const linkedToSalesChannel = new Set<string>();
  // Sales channels per product id — used to recreate only products that live
  // solely in THIS channel (deleting a shared one would hit another demo).
  const channelsByProduct = new Map<string, Set<string>>();
  // Stable source identity (`source::source_product_id`) → product id. Lets a
  // re-import find a product to recreate even when its title — and therefore its
  // handle — changed at the source, instead of leaving a stale duplicate behind.
  const idByIdentity = new Map<string, string>();
  const identityKey = (source: string | null, productId: string | null): string | null =>
    source && productId ? `${source}::${productId}` : null;
  try {
    const queryGraph: any = container.resolve(ContainerRegistrationKeys.QUERY);
    // Memory: page the catalog and accumulate ONLY the lightweight maps (handle↔id,
    // source identity, per-product channel sets, membership) — never the full
    // product objects. The previous take: 100000 loaded the whole table at once and
    // OOM'd the 2GB box. metadata is needed for the source-identity match, but it's
    // still bounded to one page at a time.
    for (let offset = 0; ; offset += PAGE) {
      const { data: productPage } = await queryGraph.graph({
        entity: 'product',
        fields: ['id', 'handle', 'metadata', 'sales_channels.id'],
        pagination: { skip: offset, take: PAGE },
      });
      const rows = (productPage ?? []) as any[];
      for (const product of rows) {
        if (product.handle) {
          handleToId.set(product.handle, product.id);
          idToHandle.set(product.id, product.handle);
        }
        const key = identityKey(
          product.metadata?.source ?? null,
          product.metadata?.source_product_id ?? null,
        );
        if (key) idByIdentity.set(key, product.id);
        const channels = Array.isArray(product.sales_channels)
          ? product.sales_channels.map((sc: any) => sc?.id).filter(Boolean)
          : [];
        channelsByProduct.set(product.id, new Set(channels));
        if (channels.includes(salesChannelId)) linkedToSalesChannel.add(product.id);
      }
      if (rows.length < PAGE) break;
    }
  } catch {
    // Fall back to a handle-only scan; linking becomes a no-op (nothing to link).
    // Memory: paged the same way — keep only handle→id, drop each page.
    for (let offset = 0; ; offset += PAGE) {
      const existingProducts: Array<{ id: string; handle: string }> =
        await productService.listProducts({}, { select: ['id', 'handle'], take: PAGE, skip: offset });
      for (const product of existingProducts) {
        handleToId.set(product.handle, product.id);
        idToHandle.set(product.id, product.handle);
      }
      if (existingProducts.length < PAGE) break;
    }
  }

  const errors: string[] = [];
  const ERROR_SAMPLE_CAP = 25;
  const recordError = (label: string, err: unknown): void => {
    if (errors.length < ERROR_SAMPLE_CAP) errors.push(`${label}: ${(err as Error).message}`);
  };

  // Recreate pass: delete products this import brings again that live ONLY in
  // this sales channel, so they get rebuilt with the latest shape (real size
  // variants). Soft-delete frees their handle/sku/barcode (partial unique
  // indexes on deleted_at), so the subsequent create reuses them cleanly.
  // Products shared with another channel are left to the link path below.
  let recreated = 0;
  if (recreateExisting) {
    const idsToDelete: string[] = [];
    const handlesToDrop: string[] = [];
    const seen = new Set<string>();
    for (const product of products) {
      // Prefer the handle match; fall back to source identity so a renamed
      // product (new handle) still recreates instead of duplicating.
      const id =
        handleToId.get(product.slug) ??
        (identityKey(product.source, product.productId)
          ? idByIdentity.get(identityKey(product.source, product.productId)!)
          : undefined);
      if (!id || seen.has(id)) continue;
      const channels = channelsByProduct.get(id);
      if (!channels || !channels.has(salesChannelId) || channels.size !== 1) continue;
      seen.add(id);
      idsToDelete.push(id);
      // Drop the product's CURRENT handle (which may differ from the incoming
      // slug when the title changed) plus the incoming slug, so neither blocks
      // the recreate in the plan's existing-handle check.
      const currentHandle = idToHandle.get(id);
      if (currentHandle) handlesToDrop.push(currentHandle);
      handlesToDrop.push(product.slug);
    }
    const DELETE_BATCH = 100;
    for (let index = 0; index < idsToDelete.length; index += DELETE_BATCH) {
      const batch = idsToDelete.slice(index, index + DELETE_BATCH);
      try {
        await deleteProductsWorkflow(container).run({ input: { ids: batch } });
        recreated += batch.length;
      } catch (err) {
        recordError(`recreate@${index}`, err);
      }
    }
    // Treat the deleted products as new: drop their handle so the plan doesn't
    // skip them, and clear the link state so they aren't double-counted.
    if (recreated > 0) {
      for (const handle of handlesToDrop) handleToId.delete(handle);
      for (const id of idsToDelete) linkedToSalesChannel.delete(id);
    }
  }

  const existingHandles = new Set(handleToId.keys());

  // Queried AFTER the recreate pass so soft-deleted variants don't reserve their
  // sku/barcode against the products we're about to recreate.
  //
  // Memory: page variants and accumulate ONLY the sku/barcode sets, dropping each
  // page. The previous take: 500000 pulled every variant row into memory at once
  // and OOM'd the 2GB box.
  const existingSkus = new Set<string>();
  const existingBarcodes = new Set<string>();
  const VARIANT_PAGE = 2000;
  for (let offset = 0; ; offset += VARIANT_PAGE) {
    const variantPage: Array<{ sku: string | null; barcode: string | null }> =
      await productService.listProductVariants(
        {},
        { select: ['sku', 'barcode'], take: VARIANT_PAGE, skip: offset },
      );
    for (const variant of variantPage) {
      if (variant.sku) existingSkus.add(variant.sku);
      if (variant.barcode) existingBarcodes.add(variant.barcode);
    }
    if (variantPage.length < VARIANT_PAGE) break;
  }

  const plan = buildPersistProductPlan({
    products,
    salesChannelId,
    currencyCode,
    existingHandles,
    existingSkus,
    existingBarcodes,
    leafCategoryId,
  });

  const total = products.length;
  const queue = plan.items;
  let created = 0;
  let failed = 0;
  let linkedBrands = 0;
  let linkedExisting = 0;

  const linkBrand = async (productId: string, brandName: string | null): Promise<void> => {
    const brandId = brandIdFor(brandName);
    if (!brandId) return;
    try {
      await brandService.createProductBrandLinks([{ product_id: productId, brand_id: brandId }]);
      linkedBrands += 1;
    } catch {
      /* best-effort brand linking */
    }
  };

  // Salvage path: a create batch runs as one transaction, so a single bad record
  // (e.g. a unique-constraint hit) fails all of it. Retry one product at a time to
  // create the good ones and capture why the rest fail (otherwise it's invisible).
  const createOne = async (item: ProductPlanItem): Promise<void> => {
    try {
      const { result } = await createProductsWorkflow(container).run({
        input: { products: [item.input] },
      });
      created += result.length;
      if (result[0]) await linkBrand((result[0] as { id: string }).id, item.product.brand);
    } catch (err) {
      failed += 1;
      recordError(item.input.handle, err);
    }
  };

  await onProgress?.({ total, imported: 0, failed: 0, skipped: plan.skipped, linked: 0 });

  for (let index = 0; index < queue.length; index += PRODUCT_BATCH) {
    const batch = queue.slice(index, index + PRODUCT_BATCH);

    try {
      const { result } = await createProductsWorkflow(container).run({
        input: { products: batch.map((item) => item.input) },
      });
      created += result.length;

      const links: Array<{ product_id: string; brand_id: string }> = [];
      for (let itemIndex = 0; itemIndex < result.length; itemIndex++) {
        const brandId = brandIdFor(batch[itemIndex]!.product.brand);
        if (brandId) {
          links.push({ product_id: (result[itemIndex] as { id: string }).id, brand_id: brandId });
        }
      }
      if (links.length > 0) {
        try {
          await brandService.createProductBrandLinks(links);
          linkedBrands += links.length;
        } catch {
          /* best-effort brand linking */
        }
      }
    } catch (batchErr) {
      recordError(`batch@${index}`, batchErr);
      for (const item of batch) await createOne(item);
    }

    await onProgress?.({ total, imported: created, failed, skipped: plan.skipped, linked: linkedExisting });
  }

  // Link pre-existing products (handle already in the DB) into this demo's sales
  // channel so the store ends up with its full catalog rather than only what this
  // run created. Skip ones already linked here; dedupe by product id.
  const toLinkIds: string[] = [];
  const seenLink = new Set<string>();
  for (const product of products) {
    const id = handleToId.get(product.slug);
    if (!id || linkedToSalesChannel.has(id) || seenLink.has(id)) continue;
    seenLink.add(id);
    toLinkIds.push(id);
  }
  const LINK_BATCH = 200;
  for (let index = 0; index < toLinkIds.length; index += LINK_BATCH) {
    const add = toLinkIds.slice(index, index + LINK_BATCH);
    try {
      await linkProductsToSalesChannelWorkflow(container).run({
        input: { id: salesChannelId, add, remove: [] },
      });
      linkedExisting += add.length;
    } catch (err) {
      recordError(`link@${index}`, err);
    }
    await onProgress?.({ total, imported: created, failed, skipped: plan.skipped, linked: linkedExisting });
  }

  // Reclassify: products we linked are no longer "skipped" — drop them from the
  // existing_handle bucket so the reported skipped count and reasons stay aligned.
  const skippedReasons: Record<string, number> = { ...plan.skippedReasons };
  if (linkedExisting > 0 && skippedReasons.existing_handle) {
    const remaining = Math.max(0, skippedReasons.existing_handle - linkedExisting);
    if (remaining > 0) skippedReasons.existing_handle = remaining;
    else delete skippedReasons.existing_handle;
  }
  const skipped = Object.values(skippedReasons).reduce((sum, count) => sum + count, 0);

  return {
    created,
    failed,
    skipped,
    skippedReasons,
    linkedExisting,
    recreated,
    linkedBrands,
    categories: catMap.size,
    errors,
  };
}
