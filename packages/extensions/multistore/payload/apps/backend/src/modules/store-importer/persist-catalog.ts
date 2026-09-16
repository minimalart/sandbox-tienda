import { createHash } from 'node:crypto';
import {
  createProductsWorkflow,
  updateProductsWorkflow,
  createProductCategoriesWorkflow,
} from '@medusajs/core-flows';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { NormalizedProduct, NormalizedVariant } from '../../lib/catalog/types';
import type { ConnectionConfig } from './config';
import { allocatePresentations, variantPresentation } from './variant-presentation';

export function catalogIdentity(
  destination: string,
  connection: string,
  externalId: string
): string {
  if (!destination || !connection || !externalId)
    throw new Error('Falta identidad externa o destino.');
  return createHash('sha256')
    .update(JSON.stringify([destination, connection, externalId]))
    .digest('hex')
    .slice(0, 32);
}
export function commercialMetadata(
  variant: NormalizedVariant,
  config: ConnectionConfig,
  previous: any = {}
) {
  const protectedFields = new Set([
    ...config.protectedFields,
    ...(Array.isArray(previous.catalog_protected_fields) ? previous.catalog_protected_fields : []),
  ]);
  const source = variant.commercial ?? {
    version: 1,
    amount: variant.price,
    listAmount: variant.listPrice,
    currencyCode: config.currencyCode,
    observedAt: new Date().toISOString(),
  };
  const effective: any = {
    ...source,
    currencyCode: config.currencyCode,
    inventoryMode: config.inventoryMode,
    priceTaxIncluded: config.priceTaxIncluded,
  };
  for (const field of ['listAmount', 'presentation', 'purchasePolicy']) {
    if (protectedFields.has(field) && previous.catalog_commercial)
      effective[field] = previous.catalog_commercial[field];
  }
  // Preserve the prior list when an incomplete source record omits it.
  if (
    source.listAmount === undefined &&
    previous.catalog_commercial?.currencyCode === config.currencyCode
  )
    effective.listAmount = previous.catalog_commercial.listAmount;
  return { ...previous, catalog_source: source, catalog_commercial: effective };
}

async function linkCatalogBrand(
  container: any,
  productId: string,
  name: string | null,
  context: { destinationId: string; connectionId: string; salesChannelId: string }
) {
  if (!name) return;
  let service: any;
  try {
    service = container.resolve('brand');
  } catch {
    return;
  }
  // Preserve an existing association, including a manually selected brand.
  if ((await service.listProductBrandLinks({ product_id: productId }, { take: 1 })).length) return;
  const handle = `catalog-brand-${catalogIdentity(context.destinationId, context.connectionId, name)}`;
  let [brand] = await service.listBrands({ handle }, { take: 1 });
  if (!brand)
    brand = await service.createBrands({
      name,
      handle,
      is_active: true,
      sales_channel_ids: [context.salesChannelId],
    });
  await service.createProductBrandLinks({ product_id: productId, brand_id: brand.id });
}

/** One product per workflow: an interruption replays only this idempotent unit. */
export async function persistCatalogProduct(
  container: any,
  context: {
    destinationId: string;
    connectionId: string;
    salesChannelId: string;
    config: ConnectionConfig;
  },
  product: NormalizedProduct
): Promise<{ id: string; action: 'created' | 'updated' }> {
  const { destinationId, connectionId, salesChannelId, config } = context;
  const key = catalogIdentity(destinationId, connectionId, product.productId);
  const handle = `catalog-${key}`;
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const catalog = container.resolve('catalog_import');
  const [record] = await catalog.listCatalogRecords({ identity: key }, { take: 1 });
  const { data } = await query.graph({
    entity: 'product',
    fields: [
      'id',
      'handle',
      'metadata',
      'images.*',
      'categories.id',
      'sales_channels.id',
      'variants.*',
      'variants.options.*',
      'variants.prices.*',
      'options.*',
      'options.values.*',
    ],
    filters: record ? { id: record.product_id } : { handle },
  });
  const existing = data?.[0];
  if (record && !existing)
    throw new Error(
      `El producto enlazado ${product.productId} fue eliminado. Revisá el vínculo antes de importar.`
    );
  if (existing && existing.metadata?.catalog_identity !== key)
    throw new Error(`Colisión de identidad para ${product.productId}; requiere enlace explícito.`);
  const protectedFields = new Set([
    ...config.protectedFields,
    ...(existing?.metadata?.catalog_protected_fields ?? []),
  ]);
  let categoryIds: string[] | undefined;
  if (!protectedFields.has('categories')) {
    let parent: string | undefined;
    const service = container.resolve(Modules.PRODUCT);
    for (let i = 0; i < product.categoryPath.length; i++) {
      const categoryKey = `catalog-category-${catalogIdentity(destinationId, connectionId, JSON.stringify(product.categoryPath.slice(0, i + 1)))}`;
      const rows = await service.listProductCategories({ handle: categoryKey }, { take: 1 });
      if (rows[0]) parent = rows[0].id;
      else {
        const { result } = await createProductCategoriesWorkflow(container).run({
          input: {
            product_categories: [
              {
                name: product.categoryPath[i]!,
                handle: categoryKey,
                parent_category_id: parent,
                is_active: true,
              },
            ],
          },
        });
        parent = result[0]!.id;
      }
    }
    // Add imported categories without removing locally maintained associations.
    categoryIds = [
      ...new Set<string>([
        ...(existing?.categories ?? []).map((c: any) => c.id),
        ...(parent ? [parent] : []),
      ]),
    ];
  }
  const normalized = product.variants?.length
    ? product.variants
    : [
        {
          value: 'Único',
          ean: product.ean,
          price: product.price,
          listPrice: product.listPrice,
          externalVariantId: product.externalVariantId ?? product.productId,
        },
      ];
  const variants: any[] = [];
  const displays: any[] = [];
  const presentationOption = existing?.options?.find((o: any) => o.title === 'Presentación');
  const priorPresentation = (v: any) =>
    v?.options?.find((o: any) => o.option_id === presentationOption?.id)?.value;
  for (const variant of normalized) {
    const externalId = variant.externalVariantId ?? variant.sku ?? variant.ean;
    if (!externalId) throw new Error(`SKU sin identidad externa: ${product.productId}.`);
    if (!Number.isFinite(variant.price) || variant.price <= 0)
      throw new Error(`Precio inválido: ${product.productId}/${externalId}.`);
    const variantKey = catalogIdentity(
      destinationId,
      connectionId,
      JSON.stringify([product.productId, externalId])
    );
    const prior = existing?.variants?.find((v: any) => v.metadata?.catalog_identity === variantKey);
    const display = variantPresentation(
      variant.value,
      externalId,
      prior,
      priorPresentation(prior),
      protectedFields
    );
    displays.push({
      ...display,
      id: prior?.id,
      previous: priorPresentation(prior),
      previousImported: prior?.metadata?.catalog_imported_variant?.presentation,
    });
    const metadata = {
      ...commercialMetadata(variant, config, prior?.metadata),
      catalog_identity: variantKey,
      external_variant_id: externalId,
      source_sku: variant.sku,
      source_ean: variant.ean,
      catalog_variant_overrides: display.overrides,
    };
    const protectedPrice =
      protectedFields.has('price') || prior?.metadata?.catalog_protected_fields?.includes('price');
    const prices =
      protectedPrice && prior
        ? undefined
        : [
            ...(prior?.prices ?? [])
              .filter(
                (p: any) =>
                  p.currency_code !== config.currencyCode ||
                  p.min_quantity != null ||
                  p.max_quantity != null ||
                  (p.rules && Object.keys(p.rules).length)
              )
              .map((p: any) => ({
                id: p.id,
                amount: p.amount,
                currency_code: p.currency_code,
                min_quantity: p.min_quantity,
                max_quantity: p.max_quantity,
                rules: p.rules,
              })),
            {
              ...(prior?.prices?.find(
                (p: any) =>
                  p.currency_code === config.currencyCode &&
                  p.min_quantity == null &&
                  p.max_quantity == null &&
                  (!p.rules || !Object.keys(p.rules).length)
              )?.id
                ? {
                    id: prior.prices.find(
                      (p: any) =>
                        p.currency_code === config.currencyCode &&
                        p.min_quantity == null &&
                        p.max_quantity == null &&
                        (!p.rules || !Object.keys(p.rules).length)
                    ).id,
                  }
                : {}),
              amount: variant.price,
              currency_code: config.currencyCode,
            },
          ];
    variants.push({
      ...(prior ? { id: prior.id } : { sku: `catalog-${variantKey}`, manage_inventory: false }),
      title: display.title,
      options: { Presentación: display.presentation },
      metadata,
      ...(prices ? { prices } : {}),
    });
  }
  const absent = (existing?.variants ?? []).filter(
    (v: any) => !variants.some((update) => update.id === v.id)
  );
  const presentations = allocatePresentations(
    displays,
    absent.map(priorPresentation).filter((v: any) => v !== undefined)
  );
  variants.forEach((variant, index) => {
    variant.options.Presentación = presentations[index];
    variant.metadata.catalog_imported_variant = {
      title: variant.title,
      presentation: presentations[index],
    };
  });
  // Existing variants absent in a partial response are intentionally left untouched.
  const common: any = {
    ...(!protectedFields.has('title') ? { title: product.title } : {}),
    ...(!protectedFields.has('description') ? { description: product.description } : {}),
    ...(!protectedFields.has('images') && product.images.length
      ? {
          images: [...new Set<string>(product.images)].map((url) => {
            const image = existing?.images?.find((i: any) => i.url === url);
            return { ...(image ? { id: image.id } : {}), url };
          }),
          thumbnail: product.images[0],
        }
      : {}),
    ...(categoryIds ? { category_ids: categoryIds } : {}),
    metadata: {
      ...existing?.metadata,
      catalog_identity: key,
      catalog_connection_id: connectionId,
      catalog_destination_id: destinationId,
      external_product_id: product.productId,
      source: product.source,
      brand: product.brand,
    },
  };
  if (existing) {
    if (!record)
      await catalog.createCatalogRecords({
        identity: key,
        connection_id: connectionId,
        destination_id: destinationId,
        external_product_id: product.productId,
        product_id: existing.id,
      });
    // Options are additive. Never replace an existing option set with a partial page.
    const option = presentationOption;
    if (!option) throw new Error('La opción de presentación fue eliminada; requiere revisión.');
    const priorValues = new Set((option.values ?? []).map((v: any) => v.value));
    const missing = [...new Set(variants.map((v) => v.options.Presentación))].filter(
      (value) => !priorValues.has(value)
    );
    if (missing.length)
      await container.resolve(Modules.PRODUCT).updateProductOptionValuesOnProduct({
        product_id: existing.id,
        product_option_id: option.id,
        add: missing.map((value) => ({ value })),
      });
    const allVariants = [
      ...(existing.variants ?? []).map((prior: any) => {
        const savedOptions = Object.fromEntries(
          (prior.options ?? []).map((value: any) => [
            existing.options.find((o: any) => o.id === value.option_id)?.title,
            value.value,
          ])
        );
        const update = variants.find((v) => v.id === prior.id);
        return update
          ? { ...update, options: { ...savedOptions, ...update.options } }
          : { id: prior.id, title: prior.title, options: savedOptions };
      }),
      ...variants.filter((v) => !v.id),
    ];
    await updateProductsWorkflow(container).run({
      input: { products: [{ id: existing.id, ...common, variants: allVariants }] },
    });
    // Remove only obsolete importer-owned ID values, after all variant links
    // have moved successfully. Never remove a value still used by an absent SKU.
    const activeValues = new Set(allVariants.map((v: any) => v.options.Presentación));
    const technicalValues = new Set(
      (existing.variants ?? []).map((v: any) => v.metadata?.external_variant_id).filter(Boolean)
    );
    const obsolete = (option.values ?? []).filter(
      (v: any) => technicalValues.has(v.value) && !activeValues.has(v.value)
    );
    if (obsolete.length)
      await container.resolve(Modules.PRODUCT).updateProductOptionValuesOnProduct({
        product_id: existing.id,
        product_option_id: option.id,
        remove: obsolete.map((v: any) => v.id),
      });
    await linkCatalogBrand(container, existing.id, product.brand, context);
    return { id: existing.id, action: 'updated' };
  }
  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          ...common,
          title: product.title,
          handle,
          status: 'published',
          options: [{ title: 'Presentación', values: variants.map((v) => v.options.Presentación) }],
          variants,
          sales_channels: [{ id: salesChannelId }],
        },
      ],
    },
  });
  await catalog.createCatalogRecords({
    identity: key,
    connection_id: connectionId,
    destination_id: destinationId,
    external_product_id: product.productId,
    product_id: result[0]!.id,
  });
  await linkCatalogBrand(container, result[0]!.id, product.brand, context);
  return { id: result[0]!.id, action: 'created' };
}
