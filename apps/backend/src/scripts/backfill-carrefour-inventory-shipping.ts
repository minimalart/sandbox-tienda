/**
 * Backfill de INVENTARIO + SHIPPING PROFILE para los productos de Carrefour.
 *
 * Contexto: la importación VTEX/Carrefour (import-vtex.ts) creó los productos
 * con `manage_inventory: false` y SIN pasar `shipping_profile_id`. Eso dejó dos
 * agujeros que rompen el checkout:
 *
 *   1) Inventario — las variantes nunca tuvieron `inventory_item` ni
 *      `inventory_level`, así que no hay stock gestionable.
 *   2) Envío (causa real del "no hay métodos de envío disponibles") — en
 *      Medusa v2 `createProductsWorkflow` SOLO enlaza un shipping profile cuando
 *      se le pasa `shipping_profile_id`; al omitirlo, los productos quedaron sin
 *      link a ningún Shipping Profile. El carrito filtra las opciones de envío
 *      por `items.variant.product.shipping_profile.id`, de modo que un producto
 *      sin profile no ofrece NINGÚN envío aunque exista la Stock Location, el
 *      Fulfillment Set, la Shipping Option y haya stock.
 *
 * Para cada producto con `metadata.source === "carrefour-vtex"`:
 *   - Enlaza el producto al Shipping Profile "Default" (si falta el link).
 *   - Por cada variante sin inventory_item:
 *       · crea el inventory_item (sku = sku de la variante),
 *       · crea el inventory_level en "Main Warehouse" con stocked_quantity 500,
 *       · linkea inventory_item ↔ variante (required_quantity 1),
 *       · pone `manage_inventory = true`.
 *
 * Idempotente: las variantes que ya tienen inventory_item y los productos que ya
 * tienen shipping profile se saltean, así se puede re-correr sin duplicar.
 *
 * La lógica vive en `runCarrefourBackfill()` para poder reusarla desde el
 * endpoint admin POST /admin/maintenance/carrefour-backfill (la DB de prod no es
 * alcanzable directo por el allowlist de DO, así que se dispara por HTTP).
 *
 * Uso como script (con DATABASE_URL alcanzable, p.ej. consola de DO):
 *   DRY-RUN:  medusa exec ./src/scripts/backfill-carrefour-inventory-shipping.ts
 *   APPLY:    APPLY=true medusa exec ./src/scripts/backfill-carrefour-inventory-shipping.ts
 *
 * Variables opcionales: STOCKED_QUANTITY (500), STOCK_LOCATION ("Main Warehouse"),
 * SHIPPING_PROFILE ("Default").
 *
 * Después de aplicar, re-correr el reindex de Typesense (typesense-sync.ts).
 */
import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import {
  createInventoryItemsWorkflow,
  updateProductVariantsWorkflow,
} from '@medusajs/core-flows';

const SOURCE = 'carrefour-vtex';
const PAGE = 200;
const WRITE_BATCH = 100;

export type BackfillOptions = {
  apply: boolean;
  /** Cantidad de la que se carga cada inventory_level. Default 500. */
  stockedQuantity?: number;
  stockLocationName?: string;
  shippingProfileName?: string;
  /**
   * Tope de productos-con-trabajo a procesar en esta corrida. Permite trocear
   * la ejecución por HTTP sin chocar contra el timeout del load balancer:
   * cuando se alcanza, se corta el scan y `capped` queda en true (quedan más).
   */
  maxMutateProducts?: number;
  logger?: { info: (m: string) => void; warn: (m: string) => void };
};

export type BackfillSummary = {
  apply: boolean;
  scanned: number;
  variantsScanned: number;
  needShipping: number;
  needInventory: number;
  needManage: number;
  skippedOrphanSku: number;
  capped: boolean;
  applied: { shippingLinks: number; inventoryItems: number; managed: number };
  locationId: string;
  shippingProfileId: string;
};

type ItemToCreate = { variantId: string; sku: string | undefined };

const noopLogger = { info: () => {}, warn: () => {} };

export async function runCarrefourBackfill(
  container: any,
  opts: BackfillOptions
): Promise<BackfillSummary> {
  const logger = opts.logger ?? noopLogger;
  const apply = opts.apply;
  const stockedQuantity = opts.stockedQuantity ?? 500;
  const stockLocationName = opts.stockLocationName || 'Main Warehouse';
  const shippingProfileName = opts.shippingProfileName || 'Default';
  const maxMutateProducts = opts.maxMutateProducts ?? Infinity;

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const stockLocationService: any = container.resolve(Modules.STOCK_LOCATION);
  const fulfillmentService: any = container.resolve(Modules.FULFILLMENT);
  const inventoryService: any = container.resolve(Modules.INVENTORY);

  // ── Prerrequisitos: Stock Location + Shipping Profile ──────────────────────
  const [stockLocation] = await stockLocationService.listStockLocations({
    name: stockLocationName,
  });
  if (!stockLocation) {
    throw new Error(
      `Stock location "${stockLocationName}" no existe. Correr "pnpm db:seed" primero.`
    );
  }
  const locationId: string = stockLocation.id;

  const [shippingProfile] = await fulfillmentService.listShippingProfiles({
    name: shippingProfileName,
  });
  if (!shippingProfile) {
    throw new Error(
      `Shipping profile "${shippingProfileName}" no existe. Correr "pnpm db:seed" primero.`
    );
  }
  const shippingProfileId: string = shippingProfile.id;

  // Guard de idempotencia ante una corrida previa interrumpida: si ya existe un
  // inventory_item con el sku de la variante (huérfano, sin link), lo saltamos y
  // avisamos en vez de chocar contra el índice único de sku.
  const existingItems: Array<{ sku: string | null }> = await inventoryService.listInventoryItems(
    {},
    { select: ['sku'], take: 1_000_000 }
  );
  const existingItemSkus = new Set(existingItems.map((i) => i.sku).filter(Boolean) as string[]);

  // ── Recolección (acotada por maxMutateProducts) ────────────────────────────
  let offset = 0;
  let scanned = 0;
  let variantsScanned = 0;
  let productsWithWork = 0;
  let capped = false;
  const productsToLinkProfile: string[] = [];
  const variantsToManage: string[] = [];
  const itemsToCreate: ItemToCreate[] = [];
  let skippedOrphanSku = 0;

  scan: for (;;) {
    const { data: products } = (await query.graph({
      entity: 'product',
      fields: [
        'id',
        'metadata',
        'shipping_profile.id',
        'variants.id',
        'variants.sku',
        'variants.manage_inventory',
        'variants.inventory_items.inventory_item_id',
      ],
      pagination: { skip: offset, take: PAGE },
    })) as { data: Array<Record<string, any>> };

    if (products.length === 0) break;

    for (const p of products) {
      if (p?.metadata?.source !== SOURCE) continue;
      scanned++;

      let productHadWork = false;

      if (!p.shipping_profile?.id) {
        productsToLinkProfile.push(p.id as string);
        productHadWork = true;
      }

      const variants: Array<Record<string, any>> = Array.isArray(p.variants) ? p.variants : [];
      for (const v of variants) {
        if (!v?.id) continue;
        variantsScanned++;

        const hasInventory =
          Array.isArray(v.inventory_items) && v.inventory_items.length > 0;

        if (!hasInventory) {
          const sku: string | undefined = v.sku || undefined;
          if (sku && existingItemSkus.has(sku)) {
            skippedOrphanSku++;
            logger.warn(
              `[backfill-carrefour] variante ${v.id} (sku=${sku}) ya tiene inventory_item huérfano sin link; revisar a mano.`
            );
          } else {
            itemsToCreate.push({ variantId: v.id, sku });
            if (sku) existingItemSkus.add(sku);
            productHadWork = true;
          }
        }

        if (v.manage_inventory !== true) {
          variantsToManage.push(v.id);
          productHadWork = true;
        }
      }

      if (productHadWork) {
        productsWithWork++;
        if (productsWithWork >= maxMutateProducts) {
          capped = true;
          break scan;
        }
      }
    }

    offset += products.length;
  }

  logger.info(
    `[backfill-carrefour] (${apply ? 'APPLY' : 'DRY-RUN'}) carrefour=${scanned} variantes=${variantsScanned} ` +
      `sin_shipping_profile=${productsToLinkProfile.length} sin_inventory_item=${itemsToCreate.length} ` +
      `a_marcar_manage=${variantsToManage.length}${capped ? ' [capped: quedan más]' : ''}` +
      (skippedOrphanSku ? ` orphan_sku=${skippedOrphanSku}` : '')
  );

  const summary: BackfillSummary = {
    apply,
    scanned,
    variantsScanned,
    needShipping: productsToLinkProfile.length,
    needInventory: itemsToCreate.length,
    needManage: variantsToManage.length,
    skippedOrphanSku,
    capped,
    applied: { shippingLinks: 0, inventoryItems: 0, managed: 0 },
    locationId,
    shippingProfileId,
  };

  if (!apply) return summary;

  // ── 1. Link producto ↔ Shipping Profile ─────────────────────────────────────
  for (let i = 0; i < productsToLinkProfile.length; i += WRITE_BATCH) {
    const batch = productsToLinkProfile.slice(i, i + WRITE_BATCH);
    await link.create(
      batch.map((productId) => ({
        [Modules.PRODUCT]: { product_id: productId },
        [Modules.FULFILLMENT]: { shipping_profile_id: shippingProfileId },
      }))
    );
    summary.applied.shippingLinks += batch.length;
    logger.info(
      `[backfill-carrefour] shipping profile ${summary.applied.shippingLinks}/${productsToLinkProfile.length}`
    );
  }

  // ── 2. Crear inventory_item + level (Main Warehouse) + link a variante ──────
  for (let i = 0; i < itemsToCreate.length; i += WRITE_BATCH) {
    const batch = itemsToCreate.slice(i, i + WRITE_BATCH);

    // createInventoryItemsWorkflow crea item + location_levels y devuelve los
    // items en el MISMO orden del input → los mapeamos a su variante por índice.
    const { result: created } = await createInventoryItemsWorkflow(container).run({
      input: {
        items: batch.map((it) => ({
          sku: it.sku,
          requires_shipping: true,
          location_levels: [{ location_id: locationId, stocked_quantity: stockedQuantity }],
        })),
      },
    });

    await link.create(
      (created as Array<{ id: string }>).map((item, idx) => ({
        [Modules.PRODUCT]: { variant_id: batch[idx]!.variantId },
        [Modules.INVENTORY]: { inventory_item_id: item.id },
        data: { required_quantity: 1 },
      }))
    );

    summary.applied.inventoryItems += batch.length;
    logger.info(
      `[backfill-carrefour] inventory items+levels+links ${summary.applied.inventoryItems}/${itemsToCreate.length}`
    );
  }

  // ── 3. manage_inventory = true ───────────────────────────────────────────────
  for (let i = 0; i < variantsToManage.length; i += WRITE_BATCH) {
    const batch = variantsToManage.slice(i, i + WRITE_BATCH);
    await updateProductVariantsWorkflow(container).run({
      input: { product_variants: batch.map((id) => ({ id, manage_inventory: true })) },
    });
    summary.applied.managed += batch.length;
    logger.info(
      `[backfill-carrefour] manage_inventory=true ${summary.applied.managed}/${variantsToManage.length}`
    );
  }

  logger.info(
    `[backfill-carrefour] LISTO. shipping=${summary.applied.shippingLinks} inventory=${summary.applied.inventoryItems} managed=${summary.applied.managed}`
  );

  return summary;
}

export default async function backfillCarrefourInventoryShipping({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const apply = process.env.APPLY === 'true';

  logger.info(
    `[backfill-carrefour] modo: ${apply ? 'APPLY (escribe)' : 'DRY-RUN (solo lee)'}`
  );

  const summary = await runCarrefourBackfill(container, {
    apply,
    stockedQuantity: Number(process.env.STOCKED_QUANTITY ?? 500),
    stockLocationName: process.env.STOCK_LOCATION,
    shippingProfileName: process.env.SHIPPING_PROFILE,
    logger,
  });

  if (!apply) {
    logger.info(
      `[backfill-carrefour] DRY-RUN: no se escribió nada. Correr con APPLY=true para aplicar.`
    );
    return;
  }

  logger.info(
    `[backfill-carrefour] Ahora re-correr el reindex de Typesense (pnpm typesense:sync). ` +
      `Resumen: ${JSON.stringify(summary.applied)}`
  );
}
