import { catalogSettingsMigrationSql } from '../modules/store-importer/settings-migration';
/** Run only against the isolated catalog_fixture database (never a real store). */
import assert from 'node:assert/strict';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import {
  createRegionsWorkflow,
  createCartWorkflow,
  addToCartWorkflow,
  updateLineItemInCartWorkflow,
  updateProductVariantsWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  completeCartWorkflow,
} from '@medusajs/core-flows';
import '../workflows/hooks/catalog-cart-validation';
import { catalogAdminContext, scopedConnection } from '../modules/store-importer/admin-context';
import { connectionConfigSchema } from '../modules/store-importer/config';
import { normalizeVtex } from '../modules/store-importer/importers/vtex-catalog';
import { persistCatalogProduct } from '../modules/store-importer/persist-catalog';
import { runCatalogJob, dispatchCatalogIndexing } from '../modules/store-importer/catalog-jobs';
import { validateCatalogLines, presentationLine } from '../lib/catalog/cart-validation';

export default async function testCatalogImportFixture({ container }: { container: any }) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const { rows } = await pg.raw('select current_database() as name');
  assert.equal(
    rows[0].name,
    'catalog_fixture',
    'This script only runs on the isolated fixture database.'
  );
  // El namespace viejo se conserva; un valor ya configurado en Tiendas gana.
  await pg.transaction(async (trx: any) => {
    await trx.raw(`CREATE TEMP TABLE site_setting (
      id text PRIMARY KEY, site_id text, namespace text NOT NULL,
      value jsonb NOT NULL, updated_at timestamptz DEFAULT now(), deleted_at timestamptz
    ) ON COMMIT DROP`);
    await trx.raw(`CREATE UNIQUE INDEX fixture_global_namespace ON site_setting(namespace)
      WHERE site_id IS NULL AND deleted_at IS NULL`);
    const old = { DEMO_IMPORT_STALE_MS: { value: 600000, is_secret: false } };
    await trx('site_setting').insert({ id: 'legacy', namespace: 'extension:store-importer', value: old });
    await trx.raw(catalogSettingsMigrationSql);
    assert.deepEqual((await trx('site_setting').where({ namespace: 'extension:multistore' }).first()).value, old);
    const current = { DEMO_IMPORT_STALE_MS: { value: 900000, is_secret: false }, OTHER: { value: 'keep', is_secret: false } };
    await trx('site_setting').where({ namespace: 'extension:multistore' }).update({ value: current });
    await trx.raw(catalogSettingsMigrationSql);
    assert.deepEqual((await trx('site_setting').where({ namespace: 'extension:multistore' }).first()).value, current);
    assert.deepEqual((await trx('site_setting').where({ namespace: 'extension:store-importer' }).first()).value, old);
  });
  const run = Date.now().toString();
  const service = container.resolve('catalog_import');
  const products = container.resolve(Modules.PRODUCT);
  const fulfillment = container.resolve(Modules.FULFILLMENT);
  if (!(await fulfillment.listShippingProfiles({ type: 'default' })).length)
    await fulfillment.createShippingProfiles({ name: 'Default fixture', type: 'default' });
  const channel = await container
    .resolve(Modules.SALES_CHANNEL)
    .createSalesChannels({ name: `Fixture ${run}` });
  const storeService = container.resolve(Modules.STORE);
  const stores = await storeService.listStores({}, { take: 1 });
  if (stores[0])
    await storeService.updateStores(stores[0].id, { default_sales_channel_id: channel.id });
  else
    await storeService.createStores({
      name: 'Fixture',
      default_sales_channel_id: channel.id,
      supported_currencies: [{ currency_code: 'ars', is_default: true }],
    });
  const user = await container
    .resolve(Modules.USER)
    .createUsers({ email: `fixture-${run}@example.com` });
  const request = {
    scope: container,
    auth_context: { actor_id: user.id, actor_type: 'user' },
    headers: {},
  };
  assert.equal(
    (await catalogAdminContext(request as any)).salesChannelId,
    channel.id,
    'Normal admin resolves destination without demo registry.'
  );
  await assert.rejects(catalogAdminContext({ ...request, auth_context: {} } as any));
  const config = connectionConfigSchema.parse({
    provider: 'vtex',
    sourceUrl: 'https://catalog.example.com',
    currencyCode: 'ars',
    fieldMapping: { unitsPerPackage: 'Content' },
    presentation: { mode: 'grouping', priceBasis: 'unit' },
    purchasePolicy: { enabled: true, allowedModes: ['unit', 'package'] },
  });
  const connection = await service.createCatalogConnections({
    name: `Fixture ${run}`,
    destination_id: (await catalogAdminContext(request as any)).destinationId,
    sales_channel_id: channel.id,
    enabled: true,
    config,
  });
  assert.equal(
    (await scopedConnection(request as any, connection.id)).connection.id,
    connection.id
  );
  const foreign = await service.createCatalogConnections({
    name: 'Other destination',
    destination_id: 'other-destination',
    sales_channel_id: channel.id,
    config,
    enabled: true,
  });
  await assert.rejects(scopedConnection(request as any, foreign.id));
  const context = {
    destinationId: connection.destination_id,
    connectionId: connection.id,
    salesChannelId: channel.id,
    config,
  };
  const raw = {
    productId: 'external-product',
    productName: 'Fixture catalog',
    categories: ['/Fixture/Category/'],
    items: [
      {
        itemId: 'unit',
        name: 'Unidad',
        images: [{ imageUrl: 'https://catalog.example.com/image.png' }],
        measurementUnit: 'l',
        unitMultiplier: 0.75,
        Content: ['12'],
        sellers: [
          { sellerId: '1', sellerDefault: true, commertialOffer: { Price: 100, ListPrice: 120 } },
        ],
      },
      {
        itemId: 'box',
        name: 'Caja',
        sellers: [
          {
            sellerId: '1',
            commertialOffer: { Price: 1000, ListPrice: 1200, AvailableQuantity: 0 },
          },
        ],
      },
    ],
  };
  const normalized = normalizeVtex(raw, config)!;
  const first = await persistCatalogProduct(container, context, normalized);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const read = async () =>
    (
      await query.graph({
        entity: 'product',
        fields: [
          'id',
          'handle',
          'title',
          'metadata',
          'images.*',
          'variants.*',
          'variants.metadata',
          'variants.prices.*',
          'variants.calculated_price.*',
          'categories.id',
          'sales_channels.id',
        ],
        filters: { id: first.id },
        context: { variants: { calculated_price: QueryContext({ currency_code: 'ars' }) } },
      })
    ).data[0];
  const before = await read();
  assert.equal(before.variants.length, 2);
  assert.equal(
    before.variants.find((v: any) => v.metadata.external_variant_id === 'unit').calculated_price
      .calculated_amount,
    100
  );
  const ids = before.variants.map((v: any) => v.id).sort();
  const second = await persistCatalogProduct(container, context, normalized);
  assert.equal(second.id, first.id);
  assert.equal(second.action, 'updated');
  const repeated = await read();
  assert.deepEqual(repeated.variants.map((v: any) => v.id).sort(), ids);
  assert.equal(repeated.categories.length, before.categories.length);
  assert.equal(repeated.images.length, 1);
  assert.deepEqual(
    repeated.images.map((i: any) => i.id),
    before.images.map((i: any) => i.id)
  );
  const unit = repeated.variants.find((v: any) => v.metadata.external_variant_id === 'unit');
  assert.equal(unit.metadata.catalog_commercial.listAmount, 120);
  assert.equal(unit.metadata.catalog_commercial.unitMultiplier, 0.75);
  assert.equal(unit.manage_inventory, false);
  const line = presentationLine(unit, 2, 'package', unit.metadata.catalog_commercial);
  assert.equal(line.quantity, 24);
  await validateCatalogLines(container, [line]);
  await assert.rejects(validateCatalogLines(container, [{ ...line, quantity: 25 }]));
  const { result: regions } = await createRegionsWorkflow(container).run({
    input: { regions: [{ name: `Fixture ${run}`, currency_code: 'ars', countries: [] }] },
  });
  const { result: cart } = await createCartWorkflow(container).run({
    input: { sales_channel_id: channel.id, region_id: regions[0]!.id, currency_code: 'ars' },
  });
  await addToCartWorkflow(container).run({ input: { cart_id: cart.id, items: [line] } });
  const cartService = container.resolve(Modules.CART);
  const cartWithItems = await cartService.retrieveCart(cart.id, { relations: ['items'] });
  assert.equal(cartWithItems.items[0].quantity, 24);
  assert.equal(Number(cartWithItems.items[0].unit_price), 100);
  assert.equal(cartWithItems.items[0].metadata.catalog_presentation.unitsPerPackage, 12);
  await assert.rejects(
    updateLineItemInCartWorkflow(container).run({
      input: { cart_id: cart.id, item_id: cartWithItems.items[0].id, update: { quantity: 25 } },
    })
  );
  await assert.rejects(
    addToCartWorkflow(container).run({
      input: { cart_id: cart.id, items: [{ variant_id: unit.id, quantity: 1 }] },
    })
  );
  assert.equal(
    (await cartService.retrieveCart(cart.id, { relations: ['items'] })).items[0].quantity,
    24
  );
  await updateProductVariantsWorkflow(container).run({
    input: {
      product_variants: [
        {
          id: unit.id,
          prices: [
            { amount: 100, currency_code: 'ars' },
            { amount: 80, currency_code: 'ars', min_quantity: 24 },
          ],
        },
      ],
    },
  });
  const { result: tierCart } = await createCartWorkflow(container).run({
    input: { sales_channel_id: channel.id, region_id: regions[0]!.id, currency_code: 'ars' },
  });
  await addToCartWorkflow(container).run({ input: { cart_id: tierCart.id, items: [line] } });
  const tierLine = (await cartService.retrieveCart(tierCart.id, { relations: ['items'] })).items[0];
  assert.equal(tierLine.quantity, 24);
  assert.equal(Number(tierLine.unit_price), 80);
  const box = repeated.variants.find((v: any) => v.metadata.external_variant_id === 'box');
  const boxCommercial = {
    ...box.metadata.catalog_commercial,
    purchasePolicy: config.purchasePolicy,
    presentation: { mode: 'own-sku', priceBasis: 'sku', unitsPerPackage: 12 },
  };
  await products.updateProductVariants(box.id, {
    metadata: {
      ...box.metadata,
      catalog_commercial: boxCommercial,
      catalog_protected_fields: ['presentation'],
    },
  });
  const boxLine = presentationLine(box, 2, 'package', boxCommercial);
  await addToCartWorkflow(container).run({ input: { cart_id: cart.id, items: [boxLine] } });
  const boughtBox = (await cartService.retrieveCart(cart.id, { relations: ['items'] })).items.find(
    (i: any) => i.variant_id === box.id
  );
  assert.equal(boughtBox.quantity, 2);
  assert.equal(Number(boughtBox.unit_price), 1000);
  // Complete an actual fixture-only order with the built-in manual payment provider.
  await cartService.updateLineItems(tierLine.id, { requires_shipping: false });
  const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
    input: { cart_id: tierCart.id },
  });
  await createPaymentSessionsWorkflow(container).run({
    input: { payment_collection_id: collection.id, provider_id: 'pp_system_default' },
  });
  const { result: completedOrder } = await completeCartWorkflow(container).run({
    input: { id: tierCart.id },
  });
  const order = await container
    .resolve(Modules.ORDER)
    .retrieveOrder(completedOrder.id, { relations: ['items'] });
  assert.equal(order.items[0].quantity, 24);
  assert.equal(order.items[0].metadata.catalog_presentation.unitsPerPackage, 12);
  assert.equal(Number(order.items[0].unit_price), 80);
  const invalidItems = (await cartService.retrieveCart(cart.id, { relations: ['items'] })).items;
  for (const i of invalidItems)
    await cartService.updateLineItems(i.id, {
      requires_shipping: false,
      ...(i.variant_id === unit.id ? { quantity: 25 } : {}),
    });
  const { result: invalidCollection } = await createPaymentCollectionForCartWorkflow(container).run(
    { input: { cart_id: cart.id } }
  );
  await createPaymentSessionsWorkflow(container).run({
    input: { payment_collection_id: invalidCollection.id, provider_id: 'pp_system_default' },
  });
  await assert.rejects(
    completeCartWorkflow(container).run({ input: { id: cart.id } }),
    (error: any) => {
      assert.match(error.message, /bultos completos/);
      return true;
    }
  );
  // Manual handle and protected list survive the next source update.
  await products.updateProducts(first.id, { handle: `manual-${run}` });
  await products.updateProductVariants(unit.id, {
    metadata: {
      ...unit.metadata,
      catalog_protected_fields: ['listAmount'],
      catalog_commercial: { ...unit.metadata.catalog_commercial, listAmount: 150 },
    },
  });
  raw.productName = 'Updated source title';
  raw.items[0]!.sellers[0]!.commertialOffer.ListPrice = 130;
  await persistCatalogProduct(container, context, normalizeVtex(raw, config)!);
  const corrected = await read();
  assert.equal(corrected.id, first.id);
  assert.equal(corrected.handle, `manual-${run}`);
  assert.equal(corrected.title, 'Updated source title');
  const correctedUnit = corrected.variants.find((v: any) => v.id === unit.id);
  assert.equal(correctedUnit.metadata.catalog_commercial.listAmount, 150);
  assert.equal(correctedUnit.metadata.catalog_source.listAmount, 130);
  const partial = {
    ...normalizeVtex(raw, config)!,
    variants: [normalizeVtex(raw, config)!.variants![0]!],
  };
  await persistCatalogProduct(container, context, partial);
  assert.equal((await read()).variants.length, 2, 'An absent SKU must not be deleted.');
  // New external SKU extends existing options without replacing prior variants.
  const third = {
    ...normalized,
    variants: [
      ...normalized.variants!,
      { ...normalized.variants![0]!, externalVariantId: 'added-sku', value: 'Added SKU' },
    ],
  };
  await persistCatalogProduct(container, context, third);
  assert.equal((await read()).variants.length, 3);
  assert.ok((await read()).variants.some((v: any) => v.id === unit.id));
  // Independent connection: same external id never merges across connections.
  const other = await service.createCatalogConnections({
    name: 'Other',
    destination_id: context.destinationId,
    sales_channel_id: channel.id,
    config,
    enabled: true,
  });
  const isolated = await persistCatalogProduct(
    container,
    { ...context, connectionId: other.id },
    normalized
  );
  assert.notEqual(isolated.id, first.id);
  // Queue uniqueness and cancellation/checkpoint recovery without provider traffic.
  const job = await service.createCatalogImports({
    connection_id: connection.id,
    destination_id: context.destinationId,
    sales_channel_id: channel.id,
    config,
    products: { items: [normalized] },
    report: { complete: true, strategy: 'fixture' },
  });
  await assert.rejects(
    service.createCatalogImports({
      connection_id: connection.id,
      destination_id: context.destinationId,
      sales_channel_id: channel.id,
      config,
    })
  );
  await Promise.all([runCatalogJob(container, job.id), runCatalogJob(container, job.id)]);
  const finished = await service.retrieveCatalogImport(job.id);
  assert.equal(finished.status, 'completed');
  assert.equal(finished.cursor, 1);
  assert.equal(finished.result.updated, 1);
  const failedBus = {
    resolve: (key: string) =>
      key === Modules.EVENT_BUS
        ? {
            emit: async () => {
              throw new Error('fixture indexing failure');
            },
          }
        : container.resolve(key),
  };
  await assert.rejects(dispatchCatalogIndexing(failedBus, finished));
  assert.equal((await service.retrieveCatalogImport(job.id)).result.indexingPending.length, 1);
  let dispatched = 0;
  const recoveredBus = {
    resolve: (key: string) =>
      key === Modules.EVENT_BUS
        ? {
            emit: async () => {
              dispatched++;
            },
          }
        : container.resolve(key),
  };
  await dispatchCatalogIndexing(recoveredBus, await service.retrieveCatalogImport(job.id));
  assert.equal(dispatched, 1);
  assert.equal((await service.retrieveCatalogImport(job.id)).result.indexingPending.length, 0);
  const cancel = await service.createCatalogImports({
    connection_id: connection.id,
    destination_id: context.destinationId,
    sales_channel_id: channel.id,
    config,
    products: { items: [normalized] },
    cancel_requested: true,
  });
  await runCatalogJob(container, cancel.id);
  assert.equal((await service.retrieveCatalogImport(cancel.id)).status, 'cancelled');
  // Real admin routes, with only provider recovery substituted by a deterministic fixture.
  const previewRoute = require('../api/admin/catalog-imports/[id]/preview/route');
  const executeRoute = require('../api/admin/catalog-imports/[id]/execute/route');
  const jobsRoute = require('../api/admin/catalog-imports/jobs/[id]/route');
  const recoveryModule = require('../modules/store-importer/catalog-jobs');
  const recover = recoveryModule.recoverCatalog;
  const catalogCounts = async () =>
    (
      await pg.raw(
        'select (select count(*) from product) as products, (select count(*) from product_variant) as variants, (select count(*) from catalog_import) as jobs, (select count(*) from catalog_record) as records'
      )
    ).rows[0];
  const counts = await catalogCounts();
  let preview: any;
  try {
    recoveryModule.recoverCatalog = async () => ({
      products: [normalized],
      report: { complete: true, fetched: 1, excluded: 0, strategy: 'fixture', warnings: [] },
    });
    await previewRoute.POST(
      { ...request, params: { id: connection.id } },
      {
        json: (body: any) => {
          preview = body;
        },
      }
    );
  } finally {
    recoveryModule.recoverCatalog = recover;
  }
  assert.deepEqual(await catalogCounts(), counts, 'Preview must not write catalog or jobs.');
  assert.equal(preview.products[0].preview_action, 'Actualizar');
  assert.ok(preview.products[0].variants[0].protected_fields.includes('listAmount'));
  await assert.rejects(
    executeRoute.POST(
      { ...request, params: { id: connection.id }, body: { configuration_digest: 'stale' } },
      {}
    )
  );
  let response: any;
  let status = 0;
  const res = {
    status: (code: number) => {
      status = code;
      return res;
    },
    json: (value: any) => {
      response = value;
    },
  };
  await executeRoute.POST(
    {
      ...request,
      params: { id: connection.id },
      body: { configuration_digest: preview.configuration_digest },
    },
    res
  );
  assert.equal(status, 202);
  assert.equal(response.job.destination_id, context.destinationId);
  await jobsRoute.POST(
    { ...request, params: { id: response.job.id }, body: { action: 'cancel' } },
    { json: () => {} }
  );
  await runCatalogJob(container, response.job.id);
  assert.equal((await service.retrieveCatalogImport(response.job.id)).status, 'cancelled');
  console.log(
    'PASS: real Medusa upsert, stable product/variant IDs, list/current price, manual protection, partial SKU preservation, connection isolation, DB queue uniqueness, concurrent workers, cancellation and canonical quantities.'
  );
}
