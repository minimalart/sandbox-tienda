/**
 * Import VTEX-fetched products into Medusa.
 *
 * Reads ./data/vtex-products.json (produced by vtex-fetch.ts) and creates:
 *  - A hierarchical product-category tree mirroring the VTEX paths
 *  - Brand entities (brand module) + product↔brand links
 *  - Products with a single variant, ARS price, images, description and
 *    metadata.brand / metadata.ean (Typesense reads brand from metadata.brand)
 *  - Inventory: cada variante se crea con manage_inventory:true (auto-crea el
 *    inventory_item) y se le da un inventory_level de STOCKED_QUANTITY (500) en
 *    "Main Warehouse".
 *  - Shipping: cada producto se enlaza al Shipping Profile "Default" — sin ese
 *    link Medusa v2 no ofrece NINGÚN método de envío en el checkout.
 *
 * Idempotent: products already present (matched by handle) are skipped, so the
 * script can be re-run safely. After running, re-index Typesense:
 *   pnpm typesense:sync
 *
 * Run with:
 *   pnpm vtex:import
 *   or: dotenv -e .env -- medusa exec ./src/scripts/import-vtex.ts
 */
import type { ExecArgs, ISalesChannelModuleService } from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from '@medusajs/framework/utils';
import {
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from '@medusajs/core-flows';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeProductTitle, resolveTitleRules } from '../modules/erp/sync/product-title';
import type { NormalizedProduct } from './vtex-fetch';

const TITLE_RULES = resolveTitleRules();

/**
 * Presentación que va al valor de la option, sacada del propio título
 * ("Albalatex mate interior x4 L" → "4 L"). Sin presentación va el placeholder,
 * que el storefront esconde (`PLACEHOLDER_VALUE_RE` en
 * `lib/util/variant-labels.ts`): mostrar "Único" en todas las cards sería ruido.
 */
const presentationOf = (title: string): string =>
  normalizeProductTitle(title, { rules: TITLE_RULES }).presentation ?? 'Único';

const INPUT_FILE = join(process.cwd(), 'src', 'scripts', 'data', 'vtex-products.json');
const PRODUCT_BATCH = 100;
const CURRENCY = process.env.DEFAULT_CURRENCY_CODE || 'ars';
const STOCK_LOCATION_NAME = process.env.STOCK_LOCATION || 'Main Warehouse';
const SHIPPING_PROFILE_NAME = process.env.SHIPPING_PROFILE || 'Default';
const STOCKED_QUANTITY = Number(process.env.STOCKED_QUANTITY ?? 500);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export default async function importVtex({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  logger.info('================================================');
  logger.info('VTEX import starting...');
  logger.info('================================================');

  // ── 0. Load cache ──────────────────────────────────────────────────────────
  let products: NormalizedProduct[];
  try {
    products = JSON.parse(await readFile(INPUT_FILE, 'utf-8')) as NormalizedProduct[];
  } catch {
    throw new Error(`Cache not found at ${INPUT_FILE}. Run "pnpm vtex:fetch" first.`);
  }
  logger.info(`Loaded ${products.length} products from cache.`);

  // ── 1. Sales channel (requires base seed) ──────────────────────────────────
  const salesChannelService: ISalesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL
  );
  const [defaultSalesChannel] = await salesChannelService.listSalesChannels({
    name: 'Default Sales Channel',
  });
  if (!defaultSalesChannel) {
    throw new Error('Default Sales Channel not found. Run "pnpm db:seed" first.');
  }
  const scId = defaultSalesChannel.id;

  const productService: any = container.resolve(Modules.PRODUCT);
  const brandService: any = container.resolve('brand');
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  // ── 1b. Inventory + shipping prerequisites ─────────────────────────────────
  // En Medusa v2 un producto sin Shipping Profile NO ofrece ningún método de
  // envío en el checkout (el carrito filtra opciones por
  // product.shipping_profile.id), y una variante sin inventory_item/level no
  // tiene stock gestionable. Resolvemos ambos acá para enlazarlos al crear los
  // productos y crear los levels después de cada batch.
  const stockLocationService: any = container.resolve(Modules.STOCK_LOCATION);
  const fulfillmentService: any = container.resolve(Modules.FULFILLMENT);

  const [stockLocation] = await stockLocationService.listStockLocations({
    name: STOCK_LOCATION_NAME,
  });
  if (!stockLocation) {
    throw new Error(
      `Stock location "${STOCK_LOCATION_NAME}" not found. Run "pnpm db:seed" first.`
    );
  }
  const locationId: string = stockLocation.id;

  const [shippingProfile] = await fulfillmentService.listShippingProfiles({
    name: SHIPPING_PROFILE_NAME,
  });
  if (!shippingProfile) {
    throw new Error(
      `Shipping profile "${SHIPPING_PROFILE_NAME}" not found. Run "pnpm db:seed" first.`
    );
  }
  const shippingProfileId: string = shippingProfile.id;

  // ── 2. Category hierarchy ──────────────────────────────────────────────────
  logger.info('Building category hierarchy...');

  type CatRow = { id: string; name: string; parent_category_id: string | null; handle: string };
  const existingCats: CatRow[] = await productService.listProductCategories(
    {},
    { select: ['id', 'name', 'parent_category_id', 'handle'], take: 100000 }
  );
  // key: `${parentId ?? 'root'}::${name}` → category id
  const catKey = (parentId: string | null, name: string) => `${parentId ?? 'root'}::${name}`;
  const catMap = new Map<string, string>();
  for (const c of existingCats) catMap.set(catKey(c.parent_category_id, c.name), c.id);

  // Medusa requires GLOBALLY-unique category handles, but VTEX repeats names
  // across branches (e.g. "Accesorios", "Pescados y mariscos"). We derive an
  // explicit handle from the full path and add a numeric suffix on any clash.
  const usedHandles = new Set(existingCats.map((c) => c.handle));
  const uniqueHandle = (base: string): string => {
    let h = base || 'cat';
    let i = 2;
    while (usedHandles.has(h)) h = `${base}-${i++}`;
    usedHandles.add(h);
    return h;
  };

  // Determine max depth across all paths and create level by level so parents
  // always exist before their children.
  const maxDepth = products.reduce((m, p) => Math.max(m, p.categoryPath.length), 0);

  for (let level = 0; level < maxDepth; level++) {
    const toCreate = new Map<
      string,
      { name: string; parent_category_id: string | null; handle: string }
    >();

    for (const p of products) {
      if (p.categoryPath.length <= level) continue;
      const name = p.categoryPath[level]!;
      // Parent is the ancestor at level-1; resolved via the running catMap.
      const parentId = level === 0 ? null : resolveParentId(p, level - 1, catMap, catKey);
      // If an ancestor isn't created yet (e.g. partial path), skip for now.
      if (level > 0 && !parentId) continue;
      const key = catKey(parentId, name);
      if (catMap.has(key) || toCreate.has(key)) continue;
      const handle = uniqueHandle(slugify(p.categoryPath.slice(0, level + 1).join(' ')));
      toCreate.set(key, { name, parent_category_id: parentId, handle });
    }

    if (toCreate.size === 0) continue;

    const input = Array.from(toCreate.values()).map((c) => ({
      name: c.name,
      handle: c.handle,
      is_active: true,
      parent_category_id: c.parent_category_id ?? undefined,
    }));

    const { result } = await createProductCategoriesWorkflow(container).run({
      input: { product_categories: input },
    });
    for (const created of result as CatRow[]) {
      catMap.set(catKey(created.parent_category_id ?? null, created.name), created.id);
    }
    logger.info(`  Level ${level}: created ${result.length} categories.`);
  }

  // Resolve the leaf category id for a product's full path.
  const leafCategoryId = (p: NormalizedProduct): string | null => {
    let parentId: string | null = null;
    let id: string | null = null;
    for (const name of p.categoryPath) {
      id = catMap.get(catKey(parentId, name)) ?? null;
      if (!id) return null;
      parentId = id;
    }
    return id;
  };

  // ── 3. Brands ──────────────────────────────────────────────────────────────
  logger.info('Building brands...');
  const brandNames = Array.from(
    new Set(products.map((p) => p.brand).filter((b): b is string => !!b))
  );

  const existingBrands: Array<{ id: string; handle: string; name: string }> =
    await brandService.listBrands({}, { select: ['id', 'handle', 'name'], take: 100000 });
  const brandByHandle = new Map(existingBrands.map((b) => [b.handle, b.id]));

  const brandsToCreate = brandNames
    .map((name) => ({ name, handle: slugify(name) }))
    .filter((b) => b.handle && !brandByHandle.has(b.handle));

  // De-dupe by handle (two brand names could slugify the same)
  const uniqueNewBrands = Array.from(
    new Map(brandsToCreate.map((b) => [b.handle, b])).values()
  );

  if (uniqueNewBrands.length > 0) {
    const created = await brandService.createBrands(uniqueNewBrands);
    for (const b of created as Array<{ id: string; handle: string }>) {
      brandByHandle.set(b.handle, b.id);
    }
    logger.info(`  Created ${uniqueNewBrands.length} brands.`);
  }

  const brandIdFor = (name: string | null): string | null =>
    name ? brandByHandle.get(slugify(name)) ?? null : null;

  // ── 4. Products ────────────────────────────────────────────────────────────
  logger.info('Creating products...');

  // SKU = EAN with whitespace stripped (some VTEX EANs contain spaces). Both
  // handles and SKUs must be globally unique in Medusa.
  const skuFor = (p: NormalizedProduct): string => (p.ean || p.slug).replace(/\s+/g, '');

  // Idempotency: skip handles/SKUs that already exist in the DB.
  const existingProducts: Array<{ handle: string }> = await productService.listProducts(
    {},
    { select: ['handle'], take: 200000 }
  );
  const existingHandles = new Set(existingProducts.map((p) => p.handle));

  const existingVariants: Array<{ sku: string | null }> = await productService.listProductVariants(
    {},
    { select: ['sku'], take: 500000 }
  );
  const existingSkus = new Set(existingVariants.map((v) => v.sku).filter(Boolean));

  // De-dupe within this run (by handle AND sku), and skip any handle Medusa
  // would reject so one bad record can't fail an entire transactional batch.
  const VALID_HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const seenHandles = new Set<string>();
  const seenSkus = new Set<string>();
  let invalidHandles = 0;
  let dupSkus = 0;
  const queue = products.filter((p) => {
    if (!VALID_HANDLE.test(p.slug)) {
      invalidHandles++;
      return false;
    }
    if (existingHandles.has(p.slug) || seenHandles.has(p.slug)) return false;
    const sku = skuFor(p);
    if (existingSkus.has(sku) || seenSkus.has(sku)) {
      dupSkus++;
      return false;
    }
    seenHandles.add(p.slug);
    seenSkus.add(sku);
    return true;
  });
  if (invalidHandles > 0) logger.warn(`  Skipped ${invalidHandles} products with invalid handles.`);
  if (dupSkus > 0) logger.warn(`  Skipped ${dupSkus} products with duplicate SKUs.`);

  logger.info(`  ${queue.length} new products to create (${products.length - queue.length} skipped).`);

  let createdCount = 0;
  let linkedCount = 0;

  for (let i = 0; i < queue.length; i += PRODUCT_BATCH) {
    const batch = queue.slice(i, i + PRODUCT_BATCH);
    const batchNum = Math.floor(i / PRODUCT_BATCH) + 1;
    const totalBatches = Math.ceil(queue.length / PRODUCT_BATCH);

    const input = batch.map((p) => {
      const leaf = leafCategoryId(p);
      return {
        title: p.title,
        handle: p.slug,
        description: p.description || undefined,
        status: ProductStatus.PUBLISHED,
        thumbnail: p.images[0] ?? undefined,
        images: p.images.map((url) => ({ url })),
        category_ids: leaf ? [leaf] : [],
        // Sin shipping_profile_id el producto no ofrece envíos en el checkout.
        shipping_profile_id: shippingProfileId,
        // La presentación se saca del propio título ("… x0,9 L" → "0,9 L") para
        // que la card del PLP tenga la etiqueta desde el import y no haga falta
        // un backfill después. Sin presentación va el placeholder, que el
        // storefront esconde a propósito.
        options: [{ title: 'Formato', values: [presentationOf(p.title)] }],
        variants: [
          {
            title: presentationOf(p.title),
            sku: skuFor(p),
            barcode: p.ean || undefined,
            // manage_inventory:true hace que el workflow auto-cree el
            // inventory_item; el inventory_level (stock) lo creamos por batch.
            manage_inventory: true,
            options: { Formato: presentationOf(p.title) },
            prices: [{ amount: p.price, currency_code: CURRENCY }],
          },
        ],
        sales_channels: [{ id: scId }],
        metadata: {
          brand: p.brand ?? undefined,
          ean: p.ean || undefined,
          source: p.source,
          vtex_list_price: p.listPrice,
        },
      };
    });

    const { result } = await createProductsWorkflow(container).run({
      input: { products: input },
    });
    createdCount += result.length;

    // Crear inventory_level (stock) en Main Warehouse para las variantes recién
    // creadas. Con manage_inventory:true el workflow ya auto-creó el
    // inventory_item y lo linkeó a la variante, pero SIN level (stock 0). Los
    // inventory_item_id no vienen en el result, así que los consultamos por las
    // variantes creadas y damos de alta los levels en una sola pasada.
    const newVariantIds = (result as Array<{ variants?: Array<{ id: string }> }>)
      .flatMap((prod) => prod.variants ?? [])
      .map((v) => v.id);
    if (newVariantIds.length > 0) {
      try {
        const { data: variantRows } = (await query.graph({
          entity: 'product_variant',
          fields: ['id', 'inventory_items.inventory_item_id'],
          filters: { id: newVariantIds },
        })) as { data: Array<{ inventory_items?: Array<{ inventory_item_id: string }> }> };

        const inventoryItemIds = variantRows
          .flatMap((v) => v.inventory_items ?? [])
          .map((ii) => ii.inventory_item_id)
          .filter(Boolean);

        if (inventoryItemIds.length > 0) {
          await createInventoryLevelsWorkflow(container).run({
            input: {
              inventory_levels: inventoryItemIds.map((inventory_item_id) => ({
                inventory_item_id,
                location_id: locationId,
                stocked_quantity: STOCKED_QUANTITY,
              })),
            },
          });
        }
      } catch (err) {
        logger.warn(`  Inventory level batch failed: ${(err as Error).message}`);
      }
    }

    // Link brands to the freshly created products (best-effort).
    const links: Array<{ product_id: string; brand_id: string }> = [];
    for (let j = 0; j < result.length; j++) {
      const brandId = brandIdFor(batch[j]!.brand);
      if (brandId) links.push({ product_id: (result[j] as { id: string }).id, brand_id: brandId });
    }
    if (links.length > 0) {
      try {
        await brandService.createProductBrandLinks(links);
        linkedCount += links.length;
      } catch (err) {
        logger.warn(`  Brand link batch failed: ${(err as Error).message}`);
      }
    }

    logger.info(`  Batch ${batchNum}/${totalBatches} — ${createdCount} products created.`);
  }

  logger.info('================================================');
  logger.info('VTEX import complete.');
  logger.info(`  Products created: ${createdCount}`);
  logger.info(`  Brand links:      ${linkedCount}`);
  logger.info(`  Categories:       ${catMap.size}`);
  logger.info('  Next: run "pnpm typesense:sync" to index everything.');
  logger.info('================================================');
}

/**
 * Resolve the category id of the ancestor at `depth` for a product path,
 * walking from the root using the running catMap.
 */
function resolveParentId(
  p: NormalizedProduct,
  depth: number,
  catMap: Map<string, string>,
  catKey: (parentId: string | null, name: string) => string
): string | null {
  let parentId: string | null = null;
  for (let l = 0; l <= depth; l++) {
    const id: string | null = catMap.get(catKey(parentId, p.categoryPath[l]!)) ?? null;
    if (!id) return null;
    parentId = id;
  }
  return parentId;
}
