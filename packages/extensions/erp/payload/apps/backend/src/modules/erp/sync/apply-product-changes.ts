import type { IStockLocationService, Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  updateProductVariantsWorkflow,
} from '@medusajs/medusa/core-flows';
import { truncateError } from '../sanitize';
import type { ErpCatalogSyncSettings } from '../types';
import type { ProductCategoryState } from './plan-category-assignments';
import type { ExistingProduct, ProductPlan } from './plan-product-updates';

/**
 * Lado de ESCRITURA de la parte de producto del catalog sync. La decisión de qué
 * hacer la toma `planProductUpdate` (pura); acá solo se ejecuta.
 *
 * Los productos nuevos nacen con el estado de `settings.created_product_status`
 * (default `draft`): sin fotos ni copy alguien tiene que revisarlos, y un `draft`
 * no entra al índice de Typesense. Pero Medusa no sabe publicar en masa desde el
 * admin, así que dejar miles de borradores es una condena a la consola — de ahí
 * que el estado sea configurable. Con `images.enabled` prendido, `published` es
 * la elección razonable: el artículo entra completo.
 *
 * NINGÚN alta sale sin shipping profile. Ver `resolveShippingProfile`: cuando no
 * hay ninguno resoluble el alta FALLA con un mensaje explícito en lugar de dejar
 * que Medusa elija uno arbitrario. Eso ya nos costó una tienda entera.
 */

const READ_CHUNK = 200;
/** Productos por llamada al upsert de metadata. */
const METADATA_CHUNK = 200;
/** Productos por llamada al upsert de campos (título, descripción, dimensiones). */
const PRODUCT_UPDATE_CHUNK = 200;
/**
 * Título de la option donde vive la presentación. `Formato` es lo que ya usa el
 * catálogo (lo puso el import); las bases tintométricas usan `Presentación`, pero
 * el título de la option no cambia lo que pinta la card — cualquier option que no
 * sea de color se muestra como etiqueta de texto.
 */
const PRESENTATION_OPTION_TITLE = 'Formato';
/** Relleno para los artículos sin presentación; el storefront lo esconde. */
const PRESENTATION_PLACEHOLDER = 'Único';

/** Lee el estado actual de los productos que matchean los códigos del ERP. */
export async function readExistingProducts(
  container: MedusaContainer,
  codes: string[]
): Promise<Map<string, ExistingProduct>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const out = new Map<string, ExistingProduct>();
  if (!codes.length) return out;

  type Row = {
    id: string;
    sku: string | null;
    barcode: string | null;
    metadata: Record<string, unknown> | null;
    product_id: string | null;
    product?: {
      id: string;
      title: string | null;
      description: string | null;
      status: string | null;
      weight: number | null;
      length: number | null;
      height: number | null;
      width: number | null;
      categories?: Array<{ id: string }> | null;
    } | null;
  };

  for (let i = 0; i < codes.length; i += READ_CHUNK) {
    const chunk = codes.slice(i, i + READ_CHUNK);
    const { data: variants } = (await query.graph({
      entity: 'product_variant',
      fields: [
        'id',
        'sku',
        'barcode',
        'metadata',
        'product_id',
        'product.id',
        'product.title',
        'product.description',
        // Lo consume la fase de estado (`planProductStatuses`): sin esto no se
        // puede saber si hay que publicar o despublicar.
        'product.status',
        'product.weight',
        'product.length',
        'product.height',
        'product.width',
        'product.categories.id',
      ],
      filters: { sku: chunk },
    })) as { data: Row[] };

    for (const variant of variants) {
      const sku = variant.sku?.trim();
      if (!sku || out.has(sku)) continue;
      const product = variant.product ?? null;
      out.set(sku, {
        product_id: product?.id ?? variant.product_id ?? '',
        variant_id: variant.id,
        title: product?.title ?? null,
        description: product?.description ?? null,
        status: product?.status ?? null,
        weight: product?.weight ?? null,
        length: product?.length ?? null,
        height: product?.height ?? null,
        width: product?.width ?? null,
        barcode: variant.barcode ?? null,
        metadata: variant.metadata ?? null,
        category_ids: (product?.categories ?? []).map((category) => category.id),
      });
    }
  }
  return out;
}

/**
 * Estado MÍNIMO para el diff de categorías/marca/familia: id del producto, sus
 * categorías actuales y su metadata.
 *
 * Existe aparte de `readExistingProducts` porque el backfill recorre el
 * catálogo COMPLETO y traer título, descripción y dimensiones de miles de
 * artículos es lo que ya volteó la caja de 2 GB en otros barridos.
 */
export async function readProductCategoryState(
  container: MedusaContainer,
  codes: string[]
): Promise<Map<string, ProductCategoryState & { product_metadata: Record<string, unknown> | null }>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const out = new Map<
    string,
    ProductCategoryState & { product_metadata: Record<string, unknown> | null }
  >();
  if (!codes.length) return out;

  type Row = {
    sku: string | null;
    product_id: string | null;
    product?: {
      id: string;
      metadata: Record<string, unknown> | null;
      categories?: Array<{ id: string }> | null;
    } | null;
  };

  for (let i = 0; i < codes.length; i += READ_CHUNK) {
    const chunk = codes.slice(i, i + READ_CHUNK);
    const { data: variants } = (await query.graph({
      entity: 'product_variant',
      fields: ['sku', 'product_id', 'product.id', 'product.metadata', 'product.categories.id'],
      filters: { sku: chunk },
    })) as { data: Row[] };

    for (const variant of variants) {
      const sku = variant.sku?.trim();
      if (!sku || out.has(sku)) continue;
      const productId = variant.product?.id ?? variant.product_id;
      if (!productId) continue;
      out.set(sku, {
        product_id: productId,
        category_ids: (variant.product?.categories ?? []).map((category) => category.id),
        product_metadata: variant.product?.metadata ?? null,
      });
    }
  }
  return out;
}

/**
 * Aplica patches de `product.metadata` en tanda.
 *
 * Va por el módulo de producto y NO por `updateProductsWorkflow` a propósito: el
 * workflow emite `product.updated` por producto y en este repo eso dispara un
 * reindex de Typesense por producto (`subscribers/product-updated-typesense-sync.ts`).
 * Con el backfill del catálogo completo serían miles de reindexes; el motor
 * emite en cambio UN evento batcheado al final. Misma decisión que la fase de
 * precios. `upsertProducts` con `{id, metadata}` es un update PARCIAL: no toca
 * categorías ni variantes.
 */
export async function applyProductMetadata(
  container: MedusaContainer,
  patches: Array<{ product_id: string; metadata: Record<string, unknown> }>
): Promise<{ updated: number; errors: string[] }> {
  const result = { updated: 0, errors: [] as string[] };
  if (!patches.length) return result;

  const productService = container.resolve(Modules.PRODUCT) as unknown as {
    upsertProducts(data: Array<Record<string, unknown>>): Promise<unknown>;
  };

  for (let i = 0; i < patches.length; i += METADATA_CHUNK) {
    const chunk = patches.slice(i, i + METADATA_CHUNK);
    try {
      await productService.upsertProducts(
        chunk.map((patch) => ({ id: patch.product_id, metadata: patch.metadata }))
      );
      result.updated += chunk.length;
    } catch (error) {
      result.errors.push(
        `No se pudo actualizar la metadata de ${chunk.length} producto(s): ${truncateError(error)}`
      );
    }
  }
  return result;
}

export type ProductApplyResult = {
  /** Códigos que fallaron, con su mensaje, para marcar el log item. */
  errors: Map<string, string>;
  /** Productos creados (código → product_id). */
  created: Map<string, string>;
  /** Productos afectados, para el reindex batcheado. */
  touchedProductIds: Set<string>;
};

/**
 * Aplica una tanda de planes de producto. Nunca lanza: los fallos vuelven en
 * `errors` para que el motor los deje asentados por artículo.
 */
export async function applyProductChanges(
  container: MedusaContainer,
  plans: Array<{ code: string; plan: ProductPlan }>,
  settings: ErpCatalogSyncSettings,
  /** Árbol espejado del ERP: `código` → id de categoría. Vacío si el espejo está apagado. */
  categoryIdByCode: Map<string, string> = new Map()
): Promise<ProductApplyResult> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const result: ProductApplyResult = {
    errors: new Map(),
    created: new Map(),
    touchedProductIds: new Set(),
  };

  // ── Updates de producto (título/descripción/dimensiones) ───────────────────
  // Van en tanda por el módulo de producto y NO uno por uno por
  // `updateProductsWorkflow`, por la misma razón que `applyProductMetadata`: el
  // workflow emite `product.updated` por producto y en este repo eso dispara un
  // reindex de Typesense por producto. El barrido que normaliza los títulos de un
  // catálogo entero son miles de productos en una corrida, y ya tuvimos un
  // incidente de CPU al 100% en 1 vCPU con trabajo pesado en loop. El reindex
  // igual ocurre: el motor emite UN evento batcheado al final con
  // `touchedProductIds`.
  const productUpdates = plans.filter(({ plan }) => plan.product_update && plan.product_id);
  if (productUpdates.length) {
    const productService = container.resolve(Modules.PRODUCT) as unknown as {
      upsertProducts(data: Array<Record<string, unknown>>): Promise<unknown>;
    };
    for (let i = 0; i < productUpdates.length; i += PRODUCT_UPDATE_CHUNK) {
      const chunk = productUpdates.slice(i, i + PRODUCT_UPDATE_CHUNK);
      try {
        // `upsertProducts` con `{id, ...campos}` es un update PARCIAL: no toca
        // variantes, categorías ni imágenes de los productos de la tanda.
        await productService.upsertProducts(
          chunk.map(({ plan }) => ({ id: plan.product_id!, ...plan.product_update }))
        );
        for (const { plan } of chunk) result.touchedProductIds.add(plan.product_id!);
      } catch (batchError) {
        // Mismo criterio que los updates de variante: reintentar de a una para no
        // marcar `failed` a 200 productos por culpa de uno.
        logger.warn(
          `[erp] catalog sync: una tanda de ${chunk.length} producto(s) falló ` +
            `(${truncateError(batchError)}); se reintenta de a una para aislar la fila.`
        );
        for (const { code, plan } of chunk) {
          try {
            await productService.upsertProducts([{ id: plan.product_id!, ...plan.product_update }]);
            result.touchedProductIds.add(plan.product_id!);
          } catch (error) {
            result.errors.set(code, truncateError(error));
          }
        }
      }
    }
  }

  // ── Updates de variante (barcode/metadata) ────────────────────────────────
  // Se agrupan en una sola llamada: el workflow acepta varias variantes y así se
  // emite un evento por tanda en lugar de uno por artículo.
  const variantUpdates = plans.filter(
    ({ code, plan }) => plan.variant_update && !result.errors.has(code)
  );
  if (variantUpdates.length) {
    const runVariantUpdates = async (
      items: typeof variantUpdates
    ): Promise<void> => {
      await updateProductVariantsWorkflow(container).run({
        input: {
          // `variant_update` ya trae su `id`; nunca trae `prices`, así que este
          // workflow no puede borrar precios del price set.
          product_variants: items.map(({ plan }) => plan.variant_update!) as never,
        },
      });
      for (const { plan } of items) {
        if (plan.product_id) result.touchedProductIds.add(plan.product_id);
      }
    };

    try {
      await runVariantUpdates(variantUpdates);
    } catch (batchError) {
      // La tanda entera falla por UNA fila (un barcode duplicado, por ejemplo), y
      // marcarlas todas `failed` acusaba a artículos que estaban bien. Se reintenta
      // de a una para aislar la culpable: solo pasa en el camino de error, así que
      // el costo extra no se paga en una corrida normal.
      logger.warn(
        `[erp] catalog sync: una tanda de ${variantUpdates.length} variante(s) falló ` +
          `(${truncateError(batchError)}); se reintenta de a una para aislar la fila.`
      );
      for (const item of variantUpdates) {
        try {
          await runVariantUpdates([item]);
        } catch (error) {
          result.errors.set(item.code, truncateError(error));
        }
      }
    }
  }

  // ── Altas ─────────────────────────────────────────────────────────────────
  const creates = plans.filter(({ plan }) => plan.status === 'created' && plan.create);
  if (creates.length) {
    const shippingProfileId = await resolveShippingProfile(container, settings);
    if (!shippingProfileId) {
      // No se crea NADA. Un producto sin shipping profile se da de alta bien, se
      // navega bien y se paga bien: revienta en `validate-shipping` dentro de
      // `completeCartWorkflow`, o sea DESPUÉS de que la pasarela cobró. El
      // comprador queda pagado y sin orden, y el catálogo entero hay que
      // repararlo a mano. Es preferible no importar.
      for (const { code } of creates) result.errors.set(code, SHIPPING_PROFILE_MISSING);
      logger.warn(
        `[erp] catalog sync: ${creates.length} alta(s) canceladas — ${SHIPPING_PROFILE_MISSING}`
      );
      return result;
    }

    const locationId = await resolveStockLocation(container, settings);
    const createdStatus = settings.created_product_status ?? 'draft';
    /**
     * Sin canal de venta un producto NO se ve en el storefront, ni siquiera
     * `published`: `/store/*` scopea por los canales de la publishable key. Es la
     * razón por la que `created_product_status: 'published'` no alcanzaba solo.
     *
     * Vacío se deja vacío a propósito: elegir "el canal default" desde acá es el
     * mismo error arbitrario que `resolveShippingProfile` evita, y en una
     * plataforma con varias tiendas significaría publicar el catálogo de un
     * cliente en la tienda de otro. Quien avisa es la UI de configuración.
     */
    const salesChannelIds = (settings.sales_channel_ids ?? []).filter(Boolean);
    if (!salesChannelIds.length && createdStatus === 'published') {
      logger.warn(
        `[erp] catalog sync: ${creates.length} alta(s) van a nacer 'published' pero sin canal de venta, ` +
          'así que NO se van a ver en la tienda. Elegí un canal en la configuración del ERP ' +
          '(Catálogo y precios → Canales de venta de los productos creados).'
      );
    }
    const existingHandles = new Set<string>();

    for (const { code, plan } of creates) {
      const create = plan.create!;
      const optionValue = create.presentation?.trim() || PRESENTATION_PLACEHOLDER;
      try {
        // El mapa manual GANA sobre el árbol espejado: es el override de quien
        // ya mapeó a mano códigos del ERP a categorías propias.
        const categoryId = create.category_code
          ? (settings.category_map?.[create.category_code] ??
            categoryIdByCode.get(create.category_code) ??
            null)
          : null;

        const handle = uniqueHandle(create.handle_seed, existingHandles);
        const { result: created } = await createProductsWorkflow(container).run({
          input: {
            products: [
              {
                title: create.title,
                handle,
                ...(create.description ? { description: create.description } : {}),
                // Default `draft` (el ERP no trae copy de venta); `published`
                // cuando el cliente lo configura así.
                status: createdStatus,
                shipping_profile_id: shippingProfileId,
                ...(salesChannelIds.length
                  ? { sales_channels: salesChannelIds.map((id) => ({ id })) }
                  : {}),
                ...(categoryId ? { categories: [{ id: categoryId }] } : {}),
                ...(create.weight !== null ? { weight: create.weight } : {}),
                ...(create.length !== null ? { length: create.length } : {}),
                ...(create.height !== null ? { height: create.height } : {}),
                ...(create.width !== null ? { width: create.width } : {}),
                // `Formato` + la presentación normalizada, para que el alta quede
                // igual que el resto del catálogo y la card pinte la etiqueta sin
                // necesidad de un backfill posterior. Sin presentación va el
                // placeholder, que el storefront esconde a propósito
                // (`PLACEHOLDER_VALUE_RE` en `lib/util/variant-labels.ts`).
                options: [{ title: PRESENTATION_OPTION_TITLE, values: [optionValue] }],
                variants: [
                  {
                    title: optionValue,
                    sku: create.sku,
                    ...(create.barcode ? { barcode: create.barcode } : {}),
                    manage_inventory: true,
                    metadata: create.metadata,
                    options: { [PRESENTATION_OPTION_TITLE]: optionValue },
                    // Sin `prices`: los carga la fase de precios con el diff.
                    prices: [],
                  },
                ],
              } as never,
            ],
          },
        });

        const product = (created as Array<{ id: string; variants?: Array<{ id: string }> }>)[0];
        if (!product?.id) {
          result.errors.set(code, 'La creación del producto no devolvió id.');
          continue;
        }
        result.created.set(code, product.id);
        result.touchedProductIds.add(product.id);

        // `manage_inventory: true` crea el inventory_item pero NO el nivel: sin
        // nivel en la location el producto queda sin stock y el stock sync no
        // tiene dónde escribir.
        if (locationId) {
          await createInventoryLevelForVariants(container, product.id, locationId, logger);
        }
      } catch (error) {
        result.errors.set(code, truncateError(error));
      }
    }
  }

  return result;
}

/** Handle único dentro de la tanda; Medusa valida unicidad global igual. */
function uniqueHandle(seed: string, used: Set<string>): string {
  const base =
    seed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || 'articulo';
  let handle = base;
  let n = 2;
  while (used.has(handle)) {
    handle = `${base}-${n++}`;
  }
  used.add(handle);
  return handle;
}

/** Stock location destino: la configurada o la más antigua. */
async function resolveStockLocation(
  container: MedusaContainer,
  settings: ErpCatalogSyncSettings
): Promise<string | null> {
  void settings;
  try {
    const stockLocationService = container.resolve<IStockLocationService>(Modules.STOCK_LOCATION);
    const locations = await stockLocationService.listStockLocations(
      {},
      { take: 1, order: { created_at: 'ASC' } }
    );
    return locations[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Motivo con el que se marcan las altas canceladas por falta de shipping profile. */
export const SHIPPING_PROFILE_MISSING =
  'No hay shipping profile para los productos nuevos: elegí uno en la configuración del ERP ' +
  '(Catálogo y precios → Shipping profile) o creá un profile con al menos una opción de envío. ' +
  'Un producto sin profile se puede comprar pero falla al cerrar el carrito, después de cobrar.';

/**
 * Shipping profile con el que se dan de alta los productos del ERP.
 *
 * `settings.shipping_profile_id` manda. Cuando no está configurado NO se deja
 * que Medusa elija solo: `createProductsWorkflow` agarra "el primer profile de
 * tipo default", y con más de un profile default en la tienda esa elección es
 * arbitraria. Acá se resuelve el profile que REALMENTE tiene shipping options, y
 * si no hay ninguno se devuelve `null` — el caller CANCELA las altas.
 *
 * No es cosmético. Un producto colgado de un profile sin opciones de envío se
 * da de alta bien, se navega bien y se paga bien: revienta al final, en
 * `validate-shipping` dentro de `completeCartWorkflow`, o sea DESPUÉS de que la
 * pasarela cobró. El comprador queda pagado y sin orden. Precedente: los 2.661
 * productos importados de Zeus para la tienda `desde-el-sur`.
 */
async function resolveShippingProfile(
  container: MedusaContainer,
  settings: ErpCatalogSyncSettings
): Promise<string | null> {
  if (settings.shipping_profile_id) return settings.shipping_profile_id;
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: options } = (await query.graph({
      entity: 'shipping_option',
      fields: ['shipping_profile_id'],
    })) as { data: Array<{ shipping_profile_id?: string | null }> };

    // El más usado por las opciones existentes: si alguien agrega un profile
    // nuevo con una sola opción de prueba, el catálogo no se muda ahí.
    const counts = new Map<string, number>();
    for (const option of options ?? []) {
      const id = option?.shipping_profile_id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [id, n] of counts) {
      if (n > bestCount) {
        best = id;
        bestCount = n;
      }
    }
    return best;
  } catch {
    return null;
  }
}

async function createInventoryLevelForVariants(
  container: MedusaContainer,
  productId: string,
  locationId: string,
  logger: Logger
): Promise<void> {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: variants } = (await query.graph({
      entity: 'product_variant',
      fields: ['id', 'inventory_items.inventory_item_id'],
      filters: { product_id: productId },
    })) as { data: Array<{ inventory_items?: Array<{ inventory_item_id: string | null }> | null }> };

    const inventoryItemIds = variants
      .flatMap((variant) => variant.inventory_items ?? [])
      .map((item) => item?.inventory_item_id)
      .filter((id): id is string => Boolean(id));
    if (!inventoryItemIds.length) return;

    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: inventoryItemIds.map((inventoryItemId) => ({
          inventory_item_id: inventoryItemId,
          location_id: locationId,
          // Arranca en 0: el stock real lo trae el stock sync del ERP.
          stocked_quantity: 0,
        })),
      },
    });
  } catch (error) {
    logger.warn(
      `[erp] catalog sync: producto ${productId} creado sin nivel de inventario ` +
        `(${truncateError(error)}); el stock sync no va a poder escribirle stock hasta que se cree.`
    );
  }
}
