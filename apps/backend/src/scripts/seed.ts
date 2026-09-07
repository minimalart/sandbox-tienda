/**
 * B2C Boilerplate seed script.
 *
 * Run with:
 *   pnpm db:seed
 *   or: dotenv -e .env -- medusa exec ./src/scripts/seed.ts
 *
 * What it creates:
 *  - Store currencies: ARS (default) + USD
 *  - Default Sales Channel
 *  - Two regions: Argentina (ARS) and Europe (EUR)
 *  - Stock location + fulfillment set (two shipping options: Standard, Express)
 *  - Andreani shipping options: "Envío por Andreani" (domicilio, calculated) +
 *    "Retiro en sucursales" (retiro/HOP) — only when ANDREANI_USERNAME is set
 *  - Publishable API key linked to the default sales channel
 *  - 2 categories, 1 sub-category, and 1 collection
 *  - 6 demo products linked to the default sales channel
 *  - 3 demo brands (brand entity + product links + metadata.brand)
 */
import {
  createAndLinkProductOptionsToProductWorkflow,
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createPriceListsWorkflow,
  createProductCategoriesWorkflow,
  createProductOptionsWorkflow,
  createProductsWorkflow,
  createPromotionsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from '@medusajs/core-flows';
import type {
  ExecArgs,
  IFulfillmentModuleService,
  IRegionModuleService,
  ISalesChannelModuleService,
  IStockLocationService,
  IStoreModuleService,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from '@medusajs/framework/utils';

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);

  const storeService: IStoreModuleService = container.resolve(ModuleRegistrationName.STORE);
  const salesChannelService: ISalesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL
  );
  const regionService: IRegionModuleService = container.resolve(ModuleRegistrationName.REGION);
  const fulfillmentService: IFulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );
  const stockLocationService: IStockLocationService = container.resolve(
    ModuleRegistrationName.STOCK_LOCATION
  );

  logger.info('================================================');
  logger.info('Starting B2C boilerplate seed...');
  logger.info('================================================');

  // ── 1. Store & Sales Channel ──────────────────────────────────────────────
  logger.info('[1/6] Store & Sales Channel...');

  const [store] = await storeService.listStores();
  if (!store) throw new Error('No store found. Run Medusa setup before seeding.');

  let [defaultSalesChannel] = await salesChannelService.listSalesChannels({
    name: 'Default Sales Channel',
  });

  if (!defaultSalesChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: 'Default Sales Channel' }] },
    });
    const created = result[0];
    if (!created) throw new Error('Failed to create default sales channel.');
    defaultSalesChannel = created;
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [
          { currency_code: 'ars', is_default: true },
          { currency_code: 'usd' },
        ],
        default_sales_channel_id: defaultSalesChannel.id,
      },
    },
  });
  logger.info(`[1/6] Store: ${store.id} | Sales channel: ${defaultSalesChannel.id}`);

  // ── 2. Regions ────────────────────────────────────────────────────────────
  logger.info('[2/6] Regions...');

  const existingRegions = await regionService.listRegions();
  let argentinaRegion = existingRegions.find((r) => r.name === 'Argentina');
  let europeRegion = existingRegions.find((r) => r.name === 'Europe');

  if (!argentinaRegion) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: 'Argentina',
            currency_code: 'ars',
            countries: ['ar'],
            payment_providers: ['pp_system_default'],
          },
        ],
      },
    });
    argentinaRegion = result[0];
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: 'ar', provider_id: 'tp_system' }],
    });
  }

  if (!europeRegion) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: 'Europe',
            currency_code: 'eur',
            countries: ['es', 'fr', 'de', 'it', 'gb', 'pt', 'nl'],
            payment_providers: ['pp_system_default'],
          },
        ],
      },
    });
    europeRegion = result[0];
    await createTaxRegionsWorkflow(container).run({
      input: ['es', 'fr', 'de', 'it', 'gb', 'pt', 'nl'].map((c) => ({
        country_code: c,
        // Without an explicit provider, tax calculation fails at add-to-cart
        // with "Unable to retrieve the tax provider with id: null"
        provider_id: 'tp_system',
      })),
    });
  }

  if (!argentinaRegion || !europeRegion) {
    throw new Error('Failed to create regions.');
  }
  logger.info(`[2/6] Argentina: ${argentinaRegion.id} | Europe: ${europeRegion.id}`);

  // ── 3. Stock Location ─────────────────────────────────────────────────────
  logger.info('[3/6] Stock location...');

  let [stockLocation] = await stockLocationService.listStockLocations({
    name: 'Main Warehouse',
  });

  if (!stockLocation) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: 'Main Warehouse',
            address: { city: 'Buenos Aires', country_code: 'AR', address_1: '' },
          },
        ],
      },
    });
    const created = result[0];
    if (!created) throw new Error('Failed to create stock location.');
    stockLocation = created;

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: 'manual_manual' },
    });

    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [defaultSalesChannel.id] },
    });
  }
  logger.info(`[3/6] Stock location: ${stockLocation.id}`);

  // ── 4. Fulfillment ────────────────────────────────────────────────────────
  logger.info('[4/6] Fulfillment...');

  // Idempotent: reuse the Default shipping profile if the seed already ran.
  let [shippingProfile] = await fulfillmentService.listShippingProfiles({ name: 'Default' });
  if (!shippingProfile) {
    const { result: shippingProfileResult } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: 'Default', type: 'default' }] },
    });
    const created = shippingProfileResult[0];
    if (!created) throw new Error('Failed to create shipping profile.');
    shippingProfile = created;
  }

  // Idempotent: reuse the fulfillment set if it already exists.
  let [fulfillmentSet] = await fulfillmentService.listFulfillmentSets({
    name: 'Main Warehouse delivery',
  });
  const fulfillmentSetExisted = !!fulfillmentSet;
  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentService.createFulfillmentSets({
      name: 'Main Warehouse delivery',
      type: 'shipping',
      service_zones: [
        {
          name: 'Argentina',
          geo_zones: [{ country_code: 'ar', type: 'country' as const }],
        },
        {
          name: 'Europe',
          geo_zones: ['es', 'fr', 'de', 'it', 'gb', 'pt', 'nl'].map((c) => ({
            country_code: c,
            type: 'country' as const,
          })),
        },
      ],
    });
  }

  // Only wire links + shipping options the first time the fulfillment set is created.
  if (!fulfillmentSetExisted) {
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  });

  const [argentinaZone, europeZone] = fulfillmentSet.service_zones ?? [];
  if (!argentinaZone || !europeZone) throw new Error('Failed to create service zones.');

  // Argentina shipping
  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: 'Envío Estándar',
        price_type: 'flat',
        provider_id: 'manual_manual',
        service_zone_id: argentinaZone.id,
        shipping_profile_id: shippingProfile.id,
        type: { label: 'Estándar', description: 'Llega en 3-5 días hábiles.', code: 'standard-ar' },
        prices: [
          { currency_code: 'ars', amount: 2500 },
          { region_id: argentinaRegion.id, amount: 2500 },
        ],
        rules: [
          { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
          { attribute: 'is_return', value: 'false', operator: 'eq' },
        ],
      },
      {
        name: 'Envío Express',
        price_type: 'flat',
        provider_id: 'manual_manual',
        service_zone_id: argentinaZone.id,
        shipping_profile_id: shippingProfile.id,
        type: { label: 'Express', description: 'Llega en 24 horas hábiles.', code: 'express-ar' },
        prices: [
          { currency_code: 'ars', amount: 5000 },
          { region_id: argentinaRegion.id, amount: 5000 },
        ],
        rules: [
          { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
          { attribute: 'is_return', value: 'false', operator: 'eq' },
        ],
      },
    ],
  });

  // Europe shipping
  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: 'Standard Shipping',
        price_type: 'flat',
        provider_id: 'manual_manual',
        service_zone_id: europeZone.id,
        shipping_profile_id: shippingProfile.id,
        type: { label: 'Standard', description: 'Ships in 2-3 business days.', code: 'standard-eu' },
        prices: [
          { currency_code: 'eur', amount: 10 },
          { region_id: europeRegion.id, amount: 10 },
        ],
        rules: [
          { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
          { attribute: 'is_return', value: 'false', operator: 'eq' },
        ],
      },
      {
        name: 'Express Shipping',
        price_type: 'flat',
        provider_id: 'manual_manual',
        service_zone_id: europeZone.id,
        shipping_profile_id: shippingProfile.id,
        type: { label: 'Express', description: 'Ships in 24 hours.', code: 'express-eu' },
        prices: [
          { currency_code: 'eur', amount: 20 },
          { region_id: europeRegion.id, amount: 20 },
        ],
        rules: [
          { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
          { attribute: 'is_return', value: 'false', operator: 'eq' },
        ],
      },
    ],
  });
  logger.info('[4/6] Fulfillment set + shipping options created.');
  } else {
    logger.info('[4/6] Fulfillment already configured, skipping.');
  }

  // ── 4b. Andreani pickup / HOP points ───────────────────────────────────────
  // Gated on ANDREANI_USERNAME (same gate as the provider in medusa-config.ts):
  // the `andreani_andreani` provider only exists when credentials are set, so
  // creating a shipping option for it without creds would fail.
  //
  // The storefront only renders Andreani HOP points (PuntoDeTercero) when a
  // *pickup*-type shipping option whose provider is Andreani is selectable
  // (isAndreaniPickupOption). Without this option the HOP lookup is never
  // triggered even though the provider + endpoints are fully wired — which is
  // exactly why HOP points were missing from the demo checkout.
  if (process.env.ANDREANI_USERNAME) {
    const [existingAndreaniPickup] = await fulfillmentService.listFulfillmentSets({
      name: 'Retiro Andreani',
    });
    if (existingAndreaniPickup) {
      logger.info('[4/6] Andreani pickup (HOP) already configured, skipping.');
    } else {
      // The provider must be enabled for the stock location before a shipping
      // option can use it (otherwise createShippingOptions fails with
      // "not enabled for the service location").
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: 'andreani_andreani' },
      });

      const andreaniPickupSet = await fulfillmentService.createFulfillmentSets({
        name: 'Retiro Andreani',
        type: 'pickup',
        service_zones: [
          {
            // Service zone names are globally unique in Medusa, so this cannot
            // reuse the "Argentina" zone of the main shipping set.
            name: 'Argentina (Andreani HOP)',
            geo_zones: [{ country_code: 'ar', type: 'country' as const }],
          },
        ],
      });

      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
        [Modules.FULFILLMENT]: { fulfillment_set_id: andreaniPickupSet.id },
      });

      const [andreaniZone] = andreaniPickupSet.service_zones ?? [];
      if (!andreaniZone) throw new Error('Failed to create Andreani pickup zone.');

      await createShippingOptionsWorkflow(container).run({
        input: [
          {
            // Name carries "Retiro" (→ pickup option) and "Andreani" (→ Andreani
            // provider) so the checkout's isAndreaniPickupOption() matches and
            // fetches HOP points (PuntoDeTercero) for the destination postal code.
            // The PuntoDeTercero lookup already returns Andreani branches AND HOP
            // points, so the option reads as "Retiro en sucursales".
            name: 'Retiro en sucursales',
            price_type: 'flat',
            provider_id: 'andreani_andreani',
            service_zone_id: andreaniZone.id,
            shipping_profile_id: shippingProfile.id,
            type: {
              label: 'Retiro HOP',
              description: 'Retirá tu pedido en un punto Andreani HOP cercano.',
              code: 'andreani-hop-ar',
            },
            // The fulfillment-option data the provider resolves at fulfillment
            // time: resolveServiceType() reads service_type/id from here, so the
            // shipment is created as PuntoDeTercero (HOP).
            data: {
              id: 'andreani-punto-tercero',
              name: 'Andreani Punto de Tercero',
              service_type: 'PuntoDeTercero',
            },
            // Flat & free keeps the option always selectable in the demo, which
            // is what triggers the HOP point lookup. Live cotización is validated
            // separately via POST /store/andreani/rates.
            prices: [
              { currency_code: 'ars', amount: 0 },
              { region_id: argentinaRegion.id, amount: 0 },
            ],
            rules: [
              { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
              { attribute: 'is_return', value: 'false', operator: 'eq' },
            ],
          },
        ],
      });
      logger.info('[4/6] Andreani pickup (HOP) shipping option created.');
    }

    // ── 4c. Andreani envío a domicilio ───────────────────────────────────────
    // Home delivery via Andreani. Lives in the main *shipping*-type fulfillment
    // set's "Argentina" service zone (NOT the pickup set) so the storefront
    // classifies it under the "Envío a domicilio" flow (_shippingMethods): its
    // name contains "andreani" but not "retiro". Price is calculated live by the
    // provider's calculatePrice() (Andreani tarifa by postal code + weight).
    const [existingAndreaniDomicilio] = await fulfillmentService.listShippingOptions({
      name: 'Envío por Andreani',
    });
    if (existingAndreaniDomicilio) {
      logger.info('[4/6] Andreani domicilio already configured, skipping.');
    } else {
      // The provider must be enabled for the stock location before a shipping
      // option can use it. Idempotent: ignore the error if the link exists.
      try {
        await link.create({
          [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
          [Modules.FULFILLMENT]: { fulfillment_provider_id: 'andreani_andreani' },
        });
      } catch {
        // already linked (e.g. by the pickup block above)
      }

      // Resolve the "Argentina" zone of the main shipping set by name — robust
      // whether the set was just created or reused on a re-run.
      const [argentinaShippingZone] = await fulfillmentService.listServiceZones({
        name: 'Argentina',
      });
      if (!argentinaShippingZone) {
        throw new Error('Argentina service zone not found for Andreani domicilio.');
      }

      await createShippingOptionsWorkflow(container).run({
        input: [
          {
            name: 'Envío por Andreani',
            // Calculated: the provider quotes the live Andreani tarifa. No flat
            // `prices` array — createShippingOptions computes via calculatePrice.
            price_type: 'calculated',
            provider_id: 'andreani_andreani',
            service_zone_id: argentinaShippingZone.id,
            shipping_profile_id: shippingProfile.id,
            type: {
              label: 'Envío a domicilio',
              description: 'Andreani te lo lleva a tu domicilio.',
              code: 'andreani-domicilio-ar',
            },
            // resolveServiceType() reads service_type/id from here → the shipment
            // is created as Domicilio (dispatched to the cart shipping address).
            data: {
              id: 'andreani-domicilio',
              name: 'Andreani Domicilio',
              service_type: 'Domicilio',
            },
            rules: [
              { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
              { attribute: 'is_return', value: 'false', operator: 'eq' },
            ],
          },
        ],
      });
      logger.info('[4/6] Andreani domicilio shipping option created.');
    }
  }

  // ── 5. API Key ────────────────────────────────────────────────────────────
  logger.info('[5/6] Publishable API key...');

  const apiKeyService: any = container.resolve(Modules.API_KEY);
  let [publishableApiKey] = await apiKeyService.listApiKeys({ type: 'publishable' });
  if (!publishableApiKey) {
    const { result: apiKeyResult } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [{ title: 'Webshop', type: 'publishable', created_by: '' }],
      },
    });
    publishableApiKey = apiKeyResult[0];
    if (!publishableApiKey) throw new Error('Failed to create API key.');
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: publishableApiKey.id, add: [defaultSalesChannel.id] },
  });
  logger.info(`[5/6] API key: ${publishableApiKey.id}`);

  // ── 6. Products ───────────────────────────────────────────────────────────
  logger.info('[6/6] Categories, collection, and products...');

  // Idempotent: if the catalog was already seeded, skip the whole product block.
  const productService: any = container.resolve(Modules.PRODUCT);
  const [, existingProductCount] = await productService.listAndCountProducts({}, { take: 0 });
  const catalogAlreadySeeded = (existingProductCount ?? 0) > 0;

  if (catalogAlreadySeeded) {
    logger.info('[6/6] Catalog already seeded, skipping products.');
  } else {

  // Collection
  const { result: collections } = await createCollectionsWorkflow(container).run({
    input: { collections: [{ title: 'Destacados', handle: 'destacados' }] },
  });
  const collection = collections[0];
  if (!collection) throw new Error('Failed to create collection.');

  // Categories
  const { result: categoryResult } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: [
        { name: 'Indumentaria', is_active: true },
        { name: 'Accesorios', is_active: true },
        { name: 'Calzado', is_active: true },
      ],
    },
  });
  const categories = categoryResult as Array<{ id: string; name: string }>;

  const getCategoryId = (name: string) => {
    const cat = categories.find((c) => c.name === name);
    if (!cat) throw new Error(`Category "${name}" not found after seed.`);
    return cat.id;
  };

  const scId = defaultSalesChannel.id;
  const colId = collection.id;

  const allProducts = [
    {
      title: 'Remera Básica de Algodón',
      handle: 'remera-basica',
      collection_id: colId,
      category_ids: [getCategoryId('Indumentaria')],
      description:
        'Remera 100% algodón peinado. Corte regular, cuello redondo y costuras reforzadas. Ideal para uso diario.',
      weight: 200,
      status: ProductStatus.PUBLISHED,
      thumbnail: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png',
      images: [
        { url: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png' },
        { url: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-back.png' },
      ],
      options: [
        { title: 'Talle', values: ['S', 'M', 'L', 'XL'] },
        { title: 'Color', values: ['Negro', 'Blanco'] },
      ],
      variants: [
        {
          title: 'S / Negro',
          sku: 'REMERA-S-NEGRO',
          options: { Talle: 'S', Color: 'Negro' },
          manage_inventory: false,
          prices: [
            { amount: 8500, currency_code: 'ars' },
            { amount: 9, currency_code: 'usd' },
          ],
        },
        {
          title: 'M / Negro',
          sku: 'REMERA-M-NEGRO',
          options: { Talle: 'M', Color: 'Negro' },
          manage_inventory: false,
          prices: [
            { amount: 8500, currency_code: 'ars' },
            { amount: 9, currency_code: 'usd' },
          ],
        },
        {
          title: 'L / Blanco',
          sku: 'REMERA-L-BLANCO',
          options: { Talle: 'L', Color: 'Blanco' },
          manage_inventory: false,
          prices: [
            { amount: 8500, currency_code: 'ars' },
            { amount: 9, currency_code: 'usd' },
          ],
        },
        {
          title: 'XL / Blanco',
          sku: 'REMERA-XL-BLANCO',
          options: { Talle: 'XL', Color: 'Blanco' },
          manage_inventory: false,
          prices: [
            { amount: 8500, currency_code: 'ars' },
            { amount: 9, currency_code: 'usd' },
          ],
        },
      ],
      sales_channels: [{ id: scId }],
    },
    {
      title: 'Pantalón Chino Slim',
      handle: 'pantalon-chino-slim',
      collection_id: colId,
      category_ids: [getCategoryId('Indumentaria')],
      description:
        'Pantalón chino de gabardina elastizada. Corte slim, bolsillos laterales y traseros. Versátil y cómodo.',
      weight: 450,
      status: ProductStatus.PUBLISHED,
      thumbnail: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/pants-merino-front.png',
      images: [
        { url: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/pants-merino-front.png' },
      ],
      options: [
        { title: 'Talle', values: ['28', '30', '32', '34'] },
        { title: 'Color', values: ['Beige', 'Verde'] },
      ],
      variants: [
        {
          title: '30 / Beige',
          sku: 'CHINO-30-BEIGE',
          options: { Talle: '30', Color: 'Beige' },
          manage_inventory: false,
          prices: [
            { amount: 22000, currency_code: 'ars' },
            { amount: 25, currency_code: 'usd' },
          ],
        },
        {
          title: '32 / Verde',
          sku: 'CHINO-32-VERDE',
          options: { Talle: '32', Color: 'Verde' },
          manage_inventory: false,
          prices: [
            { amount: 22000, currency_code: 'ars' },
            { amount: 25, currency_code: 'usd' },
          ],
        },
      ],
      sales_channels: [{ id: scId }],
    },
    {
      title: 'Zapatillas Running Pro',
      handle: 'zapatillas-running-pro',
      collection_id: colId,
      category_ids: [getCategoryId('Calzado')],
      description:
        'Zapatillas para running con suela de goma EVA, plantilla removible y sistema de amortiguación avanzado.',
      weight: 600,
      status: ProductStatus.PUBLISHED,
      thumbnail: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/shoe-front.png',
      images: [
        { url: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/shoe-front.png' },
        { url: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/shoe-side.png' },
      ],
      options: [
        { title: 'Talle', values: ['39', '40', '41', '42', '43'] },
        { title: 'Color', values: ['Blanco/Azul', 'Negro/Rojo'] },
      ],
      variants: [
        {
          title: '40 / Blanco-Azul',
          sku: 'RUN-40-BA',
          options: { Talle: '40', Color: 'Blanco/Azul' },
          manage_inventory: false,
          prices: [
            { amount: 45000, currency_code: 'ars' },
            { amount: 50, currency_code: 'usd' },
          ],
        },
        {
          title: '42 / Negro-Rojo',
          sku: 'RUN-42-NR',
          options: { Talle: '42', Color: 'Negro/Rojo' },
          manage_inventory: false,
          prices: [
            { amount: 45000, currency_code: 'ars' },
            { amount: 50, currency_code: 'usd' },
          ],
        },
      ],
      sales_channels: [{ id: scId }],
    },
    {
      title: 'Mochila Urbana 25L',
      handle: 'mochila-urbana-25l',
      category_ids: [getCategoryId('Accesorios')],
      description:
        'Mochila urbana de 25 litros con compartimento acolchado para laptop 15", bolsillos laterales y tiras reflectivas.',
      weight: 700,
      status: ProductStatus.PUBLISHED,
      thumbnail: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/bag-front.png',
      images: [
        { url: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/bag-front.png' },
        { url: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/bag-side.png' },
      ],
      options: [{ title: 'Color', values: ['Negro', 'Gris', 'Azul'] }],
      variants: [
        {
          title: 'Negro',
          sku: 'MOCHILA-NEGRO',
          options: { Color: 'Negro' },
          manage_inventory: false,
          prices: [
            { amount: 18000, currency_code: 'ars' },
            { amount: 20, currency_code: 'usd' },
          ],
        },
        {
          title: 'Gris',
          sku: 'MOCHILA-GRIS',
          options: { Color: 'Gris' },
          manage_inventory: false,
          prices: [
            { amount: 18000, currency_code: 'ars' },
            { amount: 20, currency_code: 'usd' },
          ],
        },
      ],
      sales_channels: [{ id: scId }],
    },
    {
      title: 'Buzo Oversize con Capucha',
      handle: 'buzo-oversize-capucha',
      collection_id: colId,
      category_ids: [getCategoryId('Indumentaria')],
      description:
        'Buzo oversize de felpa con capucha, bolsillo canguro y puños acanalados. Material 70% algodón / 30% poliéster.',
      weight: 550,
      status: ProductStatus.PUBLISHED,
      thumbnail: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-front.png',
      images: [
        { url: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-front.png' },
        { url: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-back.png' },
      ],
      options: [
        { title: 'Talle', values: ['S', 'M', 'L', 'XL', 'XXL'] },
        { title: 'Color', values: ['Arena', 'Azul marino', 'Bordo'] },
      ],
      variants: [
        {
          title: 'M / Arena',
          sku: 'BUZO-M-ARENA',
          options: { Talle: 'M', Color: 'Arena' },
          manage_inventory: false,
          prices: [
            { amount: 28000, currency_code: 'ars' },
            { amount: 30, currency_code: 'usd' },
          ],
        },
        {
          title: 'L / Azul marino',
          sku: 'BUZO-L-AZUL',
          options: { Talle: 'L', Color: 'Azul marino' },
          manage_inventory: false,
          prices: [
            { amount: 28000, currency_code: 'ars' },
            { amount: 30, currency_code: 'usd' },
          ],
        },
        {
          title: 'XL / Bordo',
          sku: 'BUZO-XL-BORDO',
          options: { Talle: 'XL', Color: 'Bordo' },
          manage_inventory: false,
          prices: [
            { amount: 28000, currency_code: 'ars' },
            { amount: 30, currency_code: 'usd' },
          ],
        },
      ],
      sales_channels: [{ id: scId }],
    },
    {
      title: 'Gorra Strapback',
      handle: 'gorra-strapback',
      category_ids: [getCategoryId('Accesorios')],
      description:
        'Gorra strapback de seis paneles en tela twill. Cierre ajustable en la parte trasera. Visera plana.',
      weight: 100,
      status: ProductStatus.PUBLISHED,
      thumbnail: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/hat-front.png',
      images: [
        { url: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/hat-front.png' },
        { url: 'https://medusa-public-images.s3.eu-west-1.amazonaws.com/hat-back.png' },
      ],
      options: [{ title: 'Color', values: ['Negro', 'Blanco', 'Camel'] }],
      variants: [
        {
          title: 'Negro',
          sku: 'GORRA-NEGRO',
          options: { Color: 'Negro' },
          manage_inventory: false,
          prices: [
            { amount: 7500, currency_code: 'ars' },
            { amount: 8, currency_code: 'usd' },
          ],
        },
        {
          title: 'Blanco',
          sku: 'GORRA-BLANCO',
          options: { Color: 'Blanco' },
          manage_inventory: false,
          prices: [
            { amount: 7500, currency_code: 'ars' },
            { amount: 8, currency_code: 'usd' },
          ],
        },
        {
          title: 'Camel',
          sku: 'GORRA-CAMEL',
          options: { Color: 'Camel' },
          manage_inventory: false,
          prices: [
            { amount: 7500, currency_code: 'ars' },
            { amount: 8, currency_code: 'usd' },
          ],
        },
      ],
      sales_channels: [{ id: scId }],
    },
  ];

  // ── Demo brands ───────────────────────────────────────────────────────────
  // Ship the boilerplate with working brand navigation out of the box. Two
  // parallel tracks, kept in sync (same approach as scripts/import-vtex.ts):
  //   - `metadata.brand` (string)   → what Typesense indexes for storefront facets
  //   - brand entity + product link → powers the admin widget and GET /store/brands
  const DEMO_BRANDS: Array<{ name: string; description: string }> = [
    { name: 'Urbano', description: 'Básicos de uso diario.' },
    { name: 'Norte', description: 'Casual y accesorios.' },
    { name: 'Activa', description: 'Performance y outdoor.' },
  ];
  const PRODUCT_BRANDS: Record<string, string> = {
    'remera-basica': 'Urbano',
    'buzo-oversize-capucha': 'Urbano',
    'pantalon-chino-slim': 'Norte',
    'gorra-strapback': 'Norte',
    'zapatillas-running-pro': 'Activa',
    'mochila-urbana-25l': 'Activa',
  };

  // Inject metadata.brand so `pnpm typesense:sync` indexes the brand facet.
  for (const p of allProducts) {
    const brand = PRODUCT_BRANDS[p.handle];
    if (brand) (p as { metadata?: Record<string, unknown> }).metadata = { brand };
  }

  // Seed in batches of 2 to reduce memory pressure
  const BATCH_SIZE = 2;
  const createdProducts: Array<{
    id: string;
    handle: string;
    // Variant ids are needed to attach the demo "sale" price list below.
    variants: Array<{ id: string; sku: string | null }>;
  }> = [];
  for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
    const batch = allProducts.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allProducts.length / BATCH_SIZE);
    logger.info(`[6/6] Products batch ${batchNum}/${totalBatches}...`);
    const { result } = await createProductsWorkflow(container).run({ input: { products: batch } });
    createdProducts.push(
      ...result.map(
        (p: {
          id: string;
          handle: string;
          variants?: Array<{ id: string; sku: string | null }>;
        }) => ({
          id: p.id,
          handle: p.handle,
          variants: (p.variants ?? []).map((v) => ({ id: v.id, sku: v.sku ?? null })),
        })
      )
    );
  }

  // Create brand entities + product↔brand links. The brand module exposes the
  // auto-generated `createBrands` / `createProductBrandLinks` (MedusaService).
  const brandService: any = container.resolve('brand');
  const brandHandle = (name: string) =>
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const createdBrands: Array<{ id: string; name: string }> = await brandService.createBrands(
    DEMO_BRANDS.map((b) => ({
      name: b.name,
      handle: brandHandle(b.name),
      description: b.description,
      is_active: true,
    }))
  );
  const brandIdByName = new Map(createdBrands.map((b) => [b.name, b.id]));
  const brandLinks = createdProducts
    .map((p) => {
      const brandId = brandIdByName.get(PRODUCT_BRANDS[p.handle] ?? '');
      return brandId ? { product_id: p.id, brand_id: brandId } : null;
    })
    .filter((l): l is { product_id: string; brand_id: string } => l !== null);
  if (brandLinks.length > 0) {
    await brandService.createProductBrandLinks(brandLinks);
  }
  logger.info(`[6/6] Created ${createdBrands.length} brands + ${brandLinks.length} product links.`);

  // ── Brand as a global product option (Medusa 2.16 global product options) ──
  // Demonstrates the global-options feature (https://medusajs.com/blog/
  // announcing-global-product-options-in-medusa/): ONE reusable "Marca" option
  // shared across products, linked per-product to a single brand value.
  //
  // ADDITIVE: the brand entity + link above stay the source of truth for
  // storefront filtering (Typesense reads metadata.brand). This exposes the
  // same brand as a native, reusable product option too.
  const { result: globalOptions } = await createProductOptionsWorkflow(container).run({
    input: {
      product_options: [
        {
          title: 'Marca',
          values: DEMO_BRANDS.map((b) => b.name),
          // Standalone/global (reusable across products), not product-exclusive.
          is_exclusive: false,
        } as { title: string; values: string[]; is_exclusive: boolean },
      ],
    },
  });
  const marcaOption = globalOptions[0];
  if (marcaOption) {
    const valueIdByName = new Map(
      (marcaOption.values ?? []).map((v: { id: string; value: string }) => [v.value, v.id])
    );
    let linkedOptions = 0;
    for (const p of createdProducts) {
      const valueId = valueIdByName.get(PRODUCT_BRANDS[p.handle] ?? '');
      if (!valueId) continue;
      await createAndLinkProductOptionsToProductWorkflow(container).run({
        input: { product_id: p.id, add: [{ id: marcaOption.id, value_ids: [valueId] }] },
      });
      linkedOptions++;
    }
    logger.info(
      `[6/6] Linked global "Marca" option (${marcaOption.id}) to ${linkedOptions} products.`
    );
  }

  // ── Demo promotion (visible "sale" price list) ────────────────────────────
  // The VISIBLE promotion pattern for the supermarket demo. A `sale` price list
  // lowers each targeted variant's `calculated_amount` below its
  // `original_amount`. The storefront already renders that delta everywhere
  // (struck-through original price + "% OFF" badge on home/PLP/PDP, via
  // `useProductPromotion` / `getProductPrice`) — no UI work needed.
  //
  // This is a REAL price change: it also applies at cart and checkout, not just
  // visually. See docs/recipes/promotions.md for the model (price list vs
  // Medusa Promotion vs purely-visual badge) and how to replace it per project.
  //
  // To replace per project: edit SALE_PERCENTAGE / SALE_HANDLES, or delete the
  // "Ofertas demo" price list from the admin (Settings → Price Lists).
  const SALE_PERCENTAGE = 0.2; // 20% off
  const SALE_HANDLES = new Set(['remera-basica', 'zapatillas-running-pro']);

  // Base prices come from the product input above; index them by SKU so we can
  // derive the discounted amount per currency for each variant going on sale.
  const basePricesBySku = new Map<string, Array<{ amount: number; currency_code: string }>>();
  for (const p of allProducts) {
    for (const v of p.variants) basePricesBySku.set(v.sku, v.prices);
  }

  const salePrices = createdProducts
    .filter((p) => SALE_HANDLES.has(p.handle))
    .flatMap((p) =>
      p.variants.flatMap((v) => {
        const base = v.sku ? basePricesBySku.get(v.sku) : undefined;
        if (!base) return [];
        return base.map((price) => ({
          variant_id: v.id,
          currency_code: price.currency_code,
          amount: Math.round(price.amount * (1 - SALE_PERCENTAGE)),
        }));
      })
    );

  if (salePrices.length > 0) {
    const offPct = Math.round(SALE_PERCENTAGE * 100);
    await createPriceListsWorkflow(container).run({
      input: {
        // `type: 'sale'` is what makes the storefront show the original price
        // struck through (calculated_amount < original_amount). It is honored at
        // runtime — the admin "Create price list" route passes it the same way —
        // even though the workflow input type omits the field, hence the cast.
        price_lists_data: [
          {
            title: 'Ofertas demo',
            description: `Promoción visible de demostración (-${offPct}%). Editá SALE_HANDLES / SALE_PERCENTAGE en el seed o borrá este price list para reemplazar por proyecto.`,
            type: 'sale',
            status: 'active',
            prices: salePrices,
          },
        ] as Array<{
          title: string;
          description: string;
          type: 'sale';
          status: 'active';
          prices: typeof salePrices;
        }>,
      },
    });
    logger.info(
      `[6/6] Created "Ofertas demo" price list (-${offPct}%) on ${salePrices.length} prices.`
    );
  }
  } // end: catalog seed guard

  // ── 7. Demo banners (home placements) ─────────────────────────────────────
  logger.info('[7/7] Banners...');
  try {
    const bannerService: any = container.resolve('banner');
    const existing = await bannerService.listBanners({}, { take: 1 });
    if (!existing?.length) {
      await bannerService.createBanners([
        {
          internal_name: 'Top bar — Envío gratis',
          placement: 'top_bar',
          status: 'published',
          priority: 100,
          content: { title: 'Envíos a todo el país', subtitle: null, body: null },
          cta: { url: '/store', label: 'Comprar ahora', target: '_self' },
          metadata: { card_color: '#1a1a2e' },
        },
        {
          internal_name: 'Banner principal — Demo',
          placement: 'banner_1',
          status: 'published',
          priority: 90,
          content: { title: 'Nueva colección', subtitle: 'Descubrí lo nuevo', body: null },
          media: { url: 'https://placehold.co/1440x600/png', type: 'image' },
          cta: { url: '/store', label: 'Ver colección', target: '_self' },
        },
        {
          internal_name: 'Banner 2 — Ofertas',
          placement: 'banner_2',
          status: 'published',
          priority: 80,
          content: { title: 'Hasta 40% off', subtitle: 'Por tiempo limitado', body: null },
          media: { url: 'https://placehold.co/800x600/png', type: 'image' },
          cta: { url: '/store', label: 'Ver ofertas', target: '_self' },
          metadata: { card_color: '#f5a623' },
        },
      ]);
      logger.info('[7/7] Created 3 demo banners.');
    } else {
      logger.info('[7/7] Banners already exist, skipping.');
    }
  } catch (err) {
    logger.warn(`[7/7] Banner seed skipped: ${(err as Error).message}`);
  }

  // ── 8. Demo promotions (Medusa Promotion engine) ──────────────────────────
  // Seeded OUTSIDE the catalog guard so they also apply to an already-imported
  // catalog. Puts a random ~15% of the published catalog on sale and assigns
  // each of those products EXACTLY ONE promotion (percentage / fixed /
  // buy-2-get-1), so no product ever carries more than one promo at a time
  // (single badge, single discount at cart). Re-runs re-randomize: existing demo
  // promotions/campaigns (code/identifier prefixed DEMO-/demo-) are removed
  // first. The typesense-sync script resolves promo→products and surfaces them
  // on cards + the PLP "Promociones" sidebar. See docs/recipes/promotions.md.
  logger.info('[8/8] Demo promotions...');
  try {
    const promotionService: any = container.resolve(Modules.PROMOTION);
    const productModuleService: any = container.resolve(Modules.PRODUCT);

    // Clean previous demo promotions + campaigns so re-seeding re-randomizes
    // without duplicating or colliding on campaign_identifier.
    const existingPromos: Array<{ id: string; code?: string }> =
      await promotionService.listPromotions({}, { take: 1000, select: ['id', 'code'] });
    const stalePromoIds = existingPromos
      .filter((p) => typeof p.code === 'string' && p.code.startsWith('DEMO-'))
      .map((p) => p.id);
    if (stalePromoIds.length) await promotionService.deletePromotions(stalePromoIds);

    const existingCampaigns: Array<{ id: string; campaign_identifier?: string }> =
      await promotionService.listCampaigns({}, { take: 1000, select: ['id', 'campaign_identifier'] });
    const staleCampaignIds = existingCampaigns
      .filter(
        (c) =>
          typeof c.campaign_identifier === 'string' && c.campaign_identifier.startsWith('demo-')
      )
      .map((c) => c.id);
    if (staleCampaignIds.length) await promotionService.deleteCampaigns(staleCampaignIds);

    // Fetch all published product ids and take a random ~15% sample (Fisher-Yates).
    const published: Array<{ id: string }> = await productModuleService.listProducts(
      { status: 'published' },
      { take: 100000, select: ['id'] }
    );
    const ids = published.map((p) => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = ids[i]!;
      ids[i] = ids[j]!;
      ids[j] = tmp;
    }
    const selected = ids.slice(0, Math.max(1, Math.floor(ids.length * 0.15)));

    const channelRule = {
      attribute: 'sales_channel_id',
      operator: 'eq',
      values: [defaultSalesChannel.id],
    };

    // Promo templates. Each selected product gets EXACTLY ONE promotion — a
    // product must never carry more than one promo at a time (single badge,
    // single discount at cart). One template is picked at random per product.
    const templates = [
      { code: 'DEMO-PCT-20', name: 'Hot Sale -20%', identifier: 'demo-pct-20', kind: 'percentage', value: 20 },
      { code: 'DEMO-PCT-15', name: 'Oferta -15%', identifier: 'demo-pct-15', kind: 'percentage', value: 15 },
      { code: 'DEMO-PCT-10', name: 'Descuento -10%', identifier: 'demo-pct-10', kind: 'percentage', value: 10 },
      { code: 'DEMO-FIJO-500', name: 'Rebaja $500', identifier: 'demo-fijo-500', kind: 'fixed', value: 500 },
      { code: 'DEMO-2X1', name: 'Combo 2x1', identifier: 'demo-2x1', kind: 'buyget', value: 100 },
    ] as const;
    const bucket: string[][] = templates.map(() => []);
    for (const id of selected) {
      const idx = Math.floor(Math.random() * templates.length);
      bucket[idx]!.push(id);
    }

    // Item-level percentage/fixed promotions + the order-level code, in one call.
    const promotionsData: any[] = [
      {
        code: 'DEMO-CARRITO10',
        type: 'standard',
        status: 'active',
        is_automatic: false,
        application_method: { type: 'percentage', target_type: 'order', allocation: 'across', value: 10 },
        rules: [channelRule],
      },
    ];
    templates.forEach((t, idx) => {
      if (t.kind === 'buyget') return; // handled in its own call below
      const productIds = bucket[idx] ?? [];
      if (productIds.length === 0) return;
      promotionsData.push({
        code: t.code,
        type: 'standard',
        status: 'active',
        is_automatic: true,
        application_method: {
          type: t.kind,
          target_type: 'items',
          allocation: 'across',
          value: t.value,
          ...(t.kind === 'fixed' ? { currency_code: 'ars' } : {}),
          target_rules: [{ attribute: 'items.product.id', operator: 'in', values: productIds }],
        },
        rules: [channelRule],
        campaign: { name: t.name, campaign_identifier: t.identifier },
      });
    });

    await createPromotionsWorkflow(container).run({ input: { promotionsData } });
    logger.info(
      `[8/8] Created ${promotionsData.length} promotions over ${selected.length} products (15% of ${ids.length}).`
    );

    // Buy-2-get-1 in its own call (different quantity fields).
    const buygetIdx = templates.findIndex((t) => t.kind === 'buyget');
    const buygetProducts = buygetIdx >= 0 ? (bucket[buygetIdx] ?? []) : [];
    const bt = buygetIdx >= 0 ? templates[buygetIdx] : undefined;
    if (bt && buygetProducts.length > 0) {
      const buygetData: any[] = [
        {
          code: bt.code,
          type: 'buyget',
          status: 'active',
          is_automatic: true,
          application_method: {
            type: 'percentage',
            target_type: 'items',
            allocation: 'each',
            value: 100,
            max_quantity: 1,
            apply_to_quantity: 1,
            buy_rules_min_quantity: 2,
            buy_rules: [{ attribute: 'items.product.id', operator: 'in', values: buygetProducts }],
            target_rules: [{ attribute: 'items.product.id', operator: 'in', values: buygetProducts }],
          },
          rules: [channelRule],
          campaign: { name: bt.name, campaign_identifier: bt.identifier },
        },
      ];
      try {
        await createPromotionsWorkflow(container).run({ input: { promotionsData: buygetData } });
        logger.info(`[8/8] Created buyget promotion on ${buygetProducts.length} products.`);
      } catch (err) {
        logger.warn(`[8/8] Buyget promotion skipped: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    logger.warn(`[8/8] Demo promotions skipped: ${(err as Error).message}`);
  }

  logger.info('================================================');
  logger.info(`Seed completed.`);
  logger.info(`  Sales channel: ${defaultSalesChannel.id}`);
  logger.info(`  API key: ${publishableApiKey.id}`);
  logger.info('================================================');
}
