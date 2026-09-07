/**
 * Operational provisioning for a demo store.
 *
 * Creates — within the single shared Medusa instance — the demo's own Sales
 * Channel, Region, Stock Location (linked to the channel + manual fulfillment),
 * a shipping fulfillment set with two demo shipping options, and links the demo
 * record to those resources. Also attaches the demo channel to the existing
 * publishable API key so the storefront SDK can read its catalog.
 *
 * El canal es lo único que puede venir de afuera: con `adoptSalesChannelId` la
 * demo adopta un canal que YA existe (origen de catálogo `sales_channel`) en lugar
 * de crear uno nuevo con el mismo catálogo adentro.
 *
 * Composes the core-flows used by scripts/seed.ts. Each core-flow is itself a
 * workflow that rolls back its own steps on failure; if any call here throws,
 * the caller marks the demo `failed`. (Full cross-step compensation is a Fase 2
 * hardening — see the plan.)
 */
import { randomBytes } from 'crypto';
import {
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  deleteSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from '@medusajs/core-flows';
import { createCustomerAccountWorkflow } from '@medusajs/medusa/core-flows';
import type {
  IFulfillmentModuleService,
  IRegionModuleService,
  ISalesChannelModuleService,
  IStoreModuleService,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MedusaError,
  ModuleRegistrationName,
  Modules,
} from '@medusajs/framework/utils';
import { createCompanyWorkflow } from '../../workflows/create-company';
import { linkCompanyCustomerGroupWorkflow } from '../../workflows/link-company-customer-group';
import { COMPANY_MODULE } from '../company';
import { DEMO_STORE_MODULE } from './index';
import { deleteDemoPromotions } from './promotions';

export type ProvisionInput = {
  id: string;
  name: string;
  slug: string;
  country_code: string;
  currency_code: string;
  /** When true, also provision a dedicated wholesale (B2B) setup for the demo. */
  b2bEnabled?: boolean;
  /**
   * Canal YA EXISTENTE que la demo adopta como propio (origen de catálogo
   * `sales_channel`). Cuando viene, acá no se crea ningún canal: se reusa ese.
   *
   * Sin esto, una demo cuyo catálogo sale de un canal existente terminaba con DOS
   * canales casi iguales para el mismo catálogo — el de origen y un `Demo
   * <nombre>` recién creado al que después se le vinculaban los mismos productos.
   * El canal de origen ya ES el canal de la demo: alcanza con adoptarlo.
   */
  adoptSalesChannelId?: string | null;
  /**
   * Stock location YA EXISTENTE que la demo adopta en vez de crear uno nuevo.
   * Presente: se valida que exista y se linkea al SC de la demo, saltando la
   * creación de `Depósito Demo <nombre>`. Ausente: comportamiento default
   * (crea uno dedicado).
   *
   * Sin esta opción, cada demo terminaba con su propio depósito huérfano cuando
   * en realidad el operador quería compartir el stock físico de la instancia.
   */
  reuseStockLocationId?: string | null;
};

/** Ids of the per-demo B2B resources. Credentials only present when freshly created. */
export type ProvisionB2BResult = {
  salesChannelId: string;
  customerGroupId: string | null;
  companyId: string | null;
  /** Only set when the test buyer was just created (unknown on idempotent reuse). */
  testEmail: string | null;
  testPassword: string | null;
};

export type ProvisionResult = {
  salesChannelId: string;
  regionId: string;
  stockLocationId: string;
  /** Currency actually used (follows the reused region when applicable). */
  currencyCode: string;
  /** Present only when b2bEnabled and the B2B provisioning succeeded. */
  b2b?: ProvisionB2BResult | null;
};

export type ProvisionB2BInput = {
  id: string;
  name: string;
  slug: string;
  regionId: string;
  stockLocationId: string;
};

export async function provisionDemoStore(
  container: any,
  demo: ProvisionInput,
): Promise<ProvisionResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const country = demo.country_code.toLowerCase();
  const currency = demo.currency_code.toLowerCase();

  logger.info(`[demo-store] Provisioning "${demo.name}" (${demo.slug})...`);

  // ── Store currency support ─────────────────────────────────────────────────
  // Product prices in the demo currency are only queryable if the store
  // supports that currency. Add it (keeping existing currencies + default).
  const storeService: IStoreModuleService = container.resolve(ModuleRegistrationName.STORE);
  // IMPORTANT: load the supported_currencies relation explicitly — listStores()
  // without it returns an empty array, which previously made us overwrite the
  // store currencies with just the demo currency and NO default, triggering
  // "There should be a default currency set for the store".
  const [store] = await storeService.listStores(
    {},
    { relations: ['supported_currencies'] },
  );
  if (store) {
    const supported = (store.supported_currencies ?? []).map((c: any) => ({
      currency_code: c.currency_code,
      is_default: !!c.is_default,
    }));
    if (!supported.some((c) => c.currency_code === currency)) {
      // Guarantee exactly one default: if the store somehow has none, make the
      // demo currency the default; otherwise add it as a non-default currency.
      const hasDefault = supported.some((c) => c.is_default);
      await updateStoresWorkflow(container).run({
        input: {
          selector: { id: store.id },
          update: {
            supported_currencies: [
              ...supported,
              { currency_code: currency, is_default: !hasDefault },
            ],
          },
        },
      });
    }
  }

  // ── Sales Channel ──────────────────────────────────────────────────────────
  // Con `adoptSalesChannelId` (origen de catálogo `sales_channel`) la demo TOMA
  // ese canal como propio y no se crea ninguno: el catálogo ya vive ahí, así que
  // un canal nuevo solo duplicaría el mismo catálogo en dos canales.
  // Si no, se crea `Demo <nombre>`. Idempotente: reusa el canal con ese nombre si
  // un provision anterior (fallido) ya lo había creado, así los reintentos no
  // acumulan canales huérfanos.
  const salesChannelService: ISalesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL,
  );
  let salesChannelId: string;
  if (demo.adoptSalesChannelId) {
    const [adopted] = await salesChannelService.listSalesChannels({
      id: demo.adoptSalesChannelId,
    });
    if (!adopted) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `El sales channel a adoptar (${demo.adoptSalesChannelId}) no existe.`,
      );
    }
    salesChannelId = adopted.id;
    logger.info(
      `[demo-store] Adoptando el sales channel existente ${salesChannelId} ("${adopted.name}") como canal de la demo.`,
    );
  } else {
    const scName = `Demo ${demo.name}`;
    const [existingSc] = await salesChannelService.listSalesChannels({ name: scName });
    if (existingSc) {
      salesChannelId = existingSc.id;
    } else {
      const { result: scResult } = await createSalesChannelsWorkflow(container).run({
        input: { salesChannelsData: [{ name: scName }] },
      });
      salesChannelId = scResult[0]!.id;
    }
  }

  // ── Region (+ tax region) ──────────────────────────────────────────────────
  // Medusa allows a country to belong to only ONE region globally, so we cannot
  // create a fresh region per demo for the same country (it collides with the
  // store's existing region, e.g. Argentina/ARS from the seed). Catalog
  // isolation comes from the per-demo SALES CHANNEL, not the region — so we
  // reuse the existing region that already covers the country, and only create
  // a new one when none exists. The effective currency follows that region.
  const regionService: IRegionModuleService = container.resolve(ModuleRegistrationName.REGION);
  const existingRegions = await regionService.listRegions({}, { relations: ['countries'] });
  const regionForCountry = existingRegions.find((r) =>
    (r.countries ?? []).some((c: any) => c.iso_2 === country),
  );

  let regionId: string;
  let effectiveCurrency = currency;
  if (regionForCountry) {
    regionId = regionForCountry.id;
    effectiveCurrency = regionForCountry.currency_code;
    logger.info(
      `[demo-store] Reusing region ${regionId} (${effectiveCurrency}) for country ${country}.`,
    );
  } else {
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: `Demo ${demo.name}`,
            currency_code: currency,
            countries: [country],
            payment_providers: ['pp_system_default'],
          },
        ],
      },
    });
    regionId = regionResult[0]!.id;
    // Tax region — without an explicit provider, tax calc fails at add-to-cart.
    try {
      await createTaxRegionsWorkflow(container).run({
        input: [{ country_code: country, provider_id: 'tp_system' }],
      });
    } catch (err) {
      logger.warn(`[demo-store] Tax region for ${country} skipped: ${(err as Error).message}`);
    }
  }

  // ── Stock Location (+ links) ───────────────────────────────────────────────
  // Dos caminos:
  //  - `reuseStockLocationId` presente: adopta un location existente en vez de
  //    crear uno. Se valida que exista y se linkea al SC (idempotente si el link
  //    ya está — Medusa deduplica). NO crea el link a Fulfillment: si el location
  //    ya está registrado, ese link ya existe.
  //  - Ausente: comportamiento original — crea `Depósito Demo <nombre>` +
  //    link Fulfillment + link SC.
  let stockLocationId: string;
  if (demo.reuseStockLocationId) {
    const stockLocationService = container.resolve(Modules.STOCK_LOCATION);
    const [existing] = await stockLocationService.listStockLocations({
      id: demo.reuseStockLocationId,
    });
    if (!existing) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `El stock location a reusar (${demo.reuseStockLocationId}) no existe.`,
      );
    }
    stockLocationId = existing.id;
    logger.info(
      `[demo-store] Reusing stock location ${stockLocationId} ("${existing.name}") en vez de crear uno nuevo.`,
    );
    // Solo el link SC↔SL — el link SL↔Fulfillment ya existe (o no es necesario
    // para un location administrado por la instancia). Sin este link el carrito
    // no ofrece shipping options y el checkout no completa.
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocationId, add: [salesChannelId] },
    });
  } else {
    const { result: slResult } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: `Depósito Demo ${demo.name}`,
            address: { city: '', country_code: country.toUpperCase(), address_1: '' },
          },
        ],
      },
    });
    stockLocationId = slResult[0]!.id;

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: 'manual_manual' },
    });

    // Crucial: without the SC↔stock-location link the demo cart has no shipping
    // options and checkout never completes.
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocationId, add: [salesChannelId] },
    });
  }

  // ── Fulfillment set + demo shipping options ────────────────────────────────
  const fulfillmentService: IFulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT,
  );

  // Reuse the shared Default shipping profile if present.
  let [shippingProfile] = await fulfillmentService.listShippingProfiles({ name: 'Default' });
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: 'Default', type: 'default' }] },
    });
    shippingProfile = result[0]!;
  }

  // Service-zone and fulfillment-set names are globally unique in Medusa, so
  // scope them by slug. Idempotent: reuse the set if a previous attempt created
  // it (so retrying a failed demo doesn't collide on the unique name).
  const setName = `Demo ${demo.slug} delivery`;
  let [fulfillmentSet] = await fulfillmentService.listFulfillmentSets(
    { name: setName },
    { relations: ['service_zones'] },
  );
  const fulfillmentSetExisted = !!fulfillmentSet;
  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentService.createFulfillmentSets({
      name: setName,
      type: 'shipping',
      service_zones: [
        {
          name: `Demo ${demo.slug} zone`,
          geo_zones: [{ country_code: country, type: 'country' as const }],
        },
      ],
    });
  }

  const [zone] = fulfillmentSet.service_zones ?? [];
  if (!zone) throw new Error('Failed to create demo service zone.');

  // Only wire the link + shipping options the first time the set is created.
  if (!fulfillmentSetExisted) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    });

    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: 'Retiro en tienda',
          price_type: 'flat',
          provider_id: 'manual_manual',
          service_zone_id: zone.id,
          shipping_profile_id: shippingProfile.id,
          type: { label: 'Retiro', description: 'Retiralo en la tienda.', code: `pickup-${demo.slug}` },
          prices: [
            { currency_code: effectiveCurrency, amount: 0 },
            { region_id: regionId, amount: 0 },
          ],
          rules: [
            { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
            { attribute: 'is_return', value: 'false', operator: 'eq' },
          ],
        },
        {
          name: 'Envío estándar',
          price_type: 'flat',
          provider_id: 'manual_manual',
          service_zone_id: zone.id,
          shipping_profile_id: shippingProfile.id,
          type: { label: 'Estándar', description: 'Llega en 3-5 días hábiles.', code: `standard-${demo.slug}` },
          prices: [
            { currency_code: effectiveCurrency, amount: 2500 },
            { region_id: regionId, amount: 2500 },
          ],
          rules: [
            { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
            { attribute: 'is_return', value: 'false', operator: 'eq' },
          ],
        },
      ],
    });
  }

  // ── Publishable API key ────────────────────────────────────────────────────
  // The storefront SDK reads catalog through a publishable key scoped to sales
  // channels. Attach the demo channel to the existing Webshop key so its catalog
  // is visible without minting a new key per demo.
  // Link the demo channel to ALL publishable keys — the storefront may use any
  // of them (NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY), and the backend can't know
  // which, so linking only the first one risked the storefront's key NOT
  // including the demo channel (store API → "product not found", empty PDP/cart).
  const apiKeyService: any = container.resolve(Modules.API_KEY);
  const publishableApiKeys = await apiKeyService.listApiKeys({ type: 'publishable' });
  for (const key of publishableApiKeys) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: key.id, add: [salesChannelId] },
    });
  }

  // ── Link the demo record to its resources (best-effort) ────────────────────
  // These links are auxiliary: the storefront resolves a demo via the stored
  // `sales_channel_id` column and teardown deletes resources explicitly, so the
  // feature works without them. The link tables are created by Medusa link
  // migrations; if they haven't been applied on the target DB
  // ("relation demo_store_sales_channel does not exist"), don't fail the whole
  // provision — just log and continue.
  try {
    await link.create([
      {
        [DEMO_STORE_MODULE]: { demo_store_id: demo.id },
        [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannelId },
      },
      {
        [DEMO_STORE_MODULE]: { demo_store_id: demo.id },
        [Modules.REGION]: { region_id: regionId },
      },
      {
        [DEMO_STORE_MODULE]: { demo_store_id: demo.id },
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
      },
    ]);
  } catch (err) {
    logger.warn(`[demo-store] Resource links skipped: ${(err as Error).message}`);
  }

  logger.info(
    `[demo-store] Provisioned "${demo.slug}": sc=${salesChannelId} region=${regionId} sl=${stockLocationId}`,
  );

  // ── B2B / Mayorista (best-effort) ──────────────────────────────────────────
  // Provision the wholesale setup after the B2C store is ready. Best-effort: a
  // B2B hiccup must NOT fail the whole demo (the B2C store is still valuable and
  // a retry completes B2B thanks to idempotent reuse-by-name/slug).
  let b2b: ProvisionB2BResult | null = null;
  if (demo.b2bEnabled) {
    try {
      b2b = await provisionDemoB2B(container, {
        id: demo.id,
        name: demo.name,
        slug: demo.slug,
        regionId,
        stockLocationId,
      });
    } catch (err) {
      logger.warn(`[demo-store] B2B provisioning skipped: ${(err as Error).message}`);
    }
  }

  return { salesChannelId, regionId, stockLocationId, currencyCode: effectiveCurrency, b2b };
}

/**
 * Valida que un canal existente pueda ser ADOPTADO como canal de una demo (origen
 * de catálogo `sales_channel`). Lanza `MedusaError` (→ 400 en la API) si:
 *
 *  - el canal no existe;
 *  - es el canal por defecto de la tienda principal (la demo pasaría a compartir
 *    canal con la tienda real: sus promos, banners y blog se filtrarían ahí, que es
 *    justo el problema que arrastró el carrito de una demo al store principal);
 *  - ya es el canal de OTRA demo (dos demos con el mismo canal son
 *    indistinguibles: el storefront resuelve la demo por `sales_channel_id`).
 *
 * Se valida antes de provisionar para no dejar una demo a medio armar.
 */
export async function assertAdoptableSalesChannel(
  container: any,
  input: { salesChannelId: string; excludeDemoId?: string | null },
): Promise<{ id: string; name: string }> {
  const salesChannelService: ISalesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL,
  );
  const [channel] = await salesChannelService.listSalesChannels({ id: input.salesChannelId });
  if (!channel) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `El sales channel de origen (${input.salesChannelId}) no existe.`,
    );
  }

  const storeService: IStoreModuleService = container.resolve(ModuleRegistrationName.STORE);
  const stores = await storeService.listStores({
    default_sales_channel_id: input.salesChannelId,
  } as any);
  if (stores.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `"${channel.name}" es el canal por defecto de la tienda principal: una demo no puede ` +
        'adoptarlo (compartirían catálogo, promociones y contenido). Creá un canal aparte ' +
        'para la demo y vinculale los productos que quieras mostrar.',
    );
  }

  const demoStoreService: any = container.resolve(DEMO_STORE_MODULE);
  const claimedBy = [
    ...(await demoStoreService.listDemoStores({ sales_channel_id: input.salesChannelId })),
    ...(await demoStoreService.listDemoStores({ b2b_sales_channel_id: input.salesChannelId })),
  ].filter((other: any) => other.id !== input.excludeDemoId);
  if (claimedBy.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `"${channel.name}" ya es el canal de la demo "${claimedBy[0].name}" (${claimedBy[0].slug}); ` +
        'elegí otro canal.',
    );
  }

  return { id: channel.id, name: channel.name };
}

export type AdoptSourceChannelResult = {
  /** Canal que la demo pasa a usar (el de origen). */
  salesChannelId: string;
  /** Canal duplicado que se borró, o null si no se pudo borrar. */
  deletedSalesChannelId: string | null;
};

/**
 * Repara una demo de origen `sales_channel` creada ANTES de que la demo adoptara el
 * canal de origen: quedó con DOS canales para el mismo catálogo (el de origen + un
 * `Demo <nombre>` con los mismos productos vinculados).
 *
 * La repunta al canal de origen —heredándole las stock locations de la demo y las
 * publishable keys, que es lo que necesita para servir catálogo y checkout— y borra
 * el canal duplicado. Borrar un canal solo DESVINCULA sus productos (los productos
 * son del canal de origen y siguen ahí), y se le limpian las promos de demo para no
 * dejarlas apuntando a un canal que ya no existe.
 *
 * Después de esto hay que re-indexar Typesense: los docs traen los ids de canal.
 */
export async function adoptSourceSalesChannel(
  container: any,
  input: {
    demoId: string;
    sourceSalesChannelId: string;
    currentSalesChannelId: string;
    stockLocationId?: string | null;
  },
): Promise<AdoptSourceChannelResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  // El canal de origen tiene que poder ser de esta demo (y de ninguna otra).
  await assertAdoptableSalesChannel(container, {
    salesChannelId: input.sourceSalesChannelId,
    excludeDemoId: input.demoId,
  });

  // Sin el link canal↔stock location la demo no tiene opciones de envío.
  if (input.stockLocationId) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: input.stockLocationId, add: [input.sourceSalesChannelId] },
    });
  }
  const apiKeyService: any = container.resolve(Modules.API_KEY);
  const publishableApiKeys = await apiKeyService.listApiKeys({ type: 'publishable' });
  for (const key of publishableApiKeys) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: key.id, add: [input.sourceSalesChannelId] },
    });
  }

  let deletedSalesChannelId: string | null = null;
  try {
    await deleteDemoPromotions(container, input.currentSalesChannelId);
    await deleteSalesChannelsWorkflow(container).run({
      input: { ids: [input.currentSalesChannelId] },
    });
    deletedSalesChannelId = input.currentSalesChannelId;
  } catch (err) {
    logger.warn(
      `[demo-store] No se pudo borrar el canal duplicado ${input.currentSalesChannelId}: ${(err as Error).message}`,
    );
  }

  logger.info(
    `[demo-store] Demo ${input.demoId} repuntada al canal de origen ${input.sourceSalesChannelId}` +
      `${deletedSalesChannelId ? ` (canal duplicado ${deletedSalesChannelId} borrado)` : ''}.`,
  );

  return { salesChannelId: input.sourceSalesChannelId, deletedSalesChannelId };
}

/** Readable, unique-enough demo password (>= 8 chars). */
function genDemoPassword(): string {
  return `Mayorista${randomBytes(4).toString('hex')}!`;
}

/**
 * Empresa + comprador de EJEMPLO del portal mayorista. A propósito NO llevan el
 * nombre del demo (la tienda vendedora): usar el nombre del demo confunde al
 * comprador con el vendedor en el portal. Genéricos, sirven para cualquier
 * vertical. El slug de la empresa sí queda keyed por demo (unicidad).
 */
const B2B_DEMO_COMPANY_NAME = 'Distribuidora Demo';
const B2B_DEMO_BUYER_FIRST = 'Juan';
const B2B_DEMO_BUYER_LAST = 'Pérez';

/**
 * Provision the per-demo B2B / Mayorista setup: a DEDICATED wholesale sales
 * channel (isolated from the demo's B2C channel), linked to the SAME region +
 * stock location (so it reuses the demo's shipping options) + all publishable
 * keys; a customer group; and a demo company with a test buyer so the portal is
 * usable right away. The tiered wholesale PRICE LIST is created post-import
 * (see b2b-pricing.ts) because it depends on the imported products' prices.
 *
 * Idempotent: reuses the channel/group by name and the company by slug, and
 * reuses an existing customer if the test email is already registered — so it is
 * safe to call again on retry or when enabling B2B on an existing demo.
 */
export async function provisionDemoB2B(
  container: any,
  input: ProvisionB2BInput,
): Promise<ProvisionB2BResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const salesChannelService: ISalesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL,
  );
  const customerService: any = container.resolve(Modules.CUSTOMER);
  const companyService: any = container.resolve(COMPANY_MODULE);
  const authModule: any = container.resolve(Modules.AUTH);

  logger.info(`[demo-store] Provisioning B2B for "${input.slug}"...`);

  // ── Wholesale sales channel (idempotent by name) ───────────────────────────
  const scName = `Demo ${input.name} · Mayorista`;
  const [existingSc] = await salesChannelService.listSalesChannels({ name: scName });
  let salesChannelId: string;
  if (existingSc) {
    salesChannelId = existingSc.id;
  } else {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          { name: scName, metadata: { channel_type: 'b2b', demo_slug: input.slug } } as any,
        ],
      },
    });
    salesChannelId = result[0]!.id;
  }

  // ── Links: same stock location (reuses shipping options) + all api keys ─────
  // Crucial: without the SC↔stock-location link the B2B cart has no shipping
  // options and checkout never completes.
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: input.stockLocationId, add: [salesChannelId] },
  });
  const apiKeyService: any = container.resolve(Modules.API_KEY);
  const publishableApiKeys = await apiKeyService.listApiKeys({ type: 'publishable' });
  for (const key of publishableApiKeys) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: key.id, add: [salesChannelId] },
    });
  }

  // ── Customer group (idempotent by name) ────────────────────────────────────
  const groupName = `Mayorista Demo ${input.name}`;
  const [existingGroup] = await customerService.listCustomerGroups({ name: groupName });
  let customerGroupId: string | null = existingGroup?.id ?? null;
  if (!customerGroupId) {
    const created = await customerService.createCustomerGroups([
      { name: groupName, metadata: { demo_id: input.id } },
    ]);
    const group = Array.isArray(created) ? created[0] : created;
    customerGroupId = group?.id ?? null;
  }

  // ── Demo company + test buyer (idempotent by company slug) ──────────────────
  const companySlug = `mayorista-${input.slug}`;
  const [existingCompany] = await companyService.listCompanies({ slug: companySlug });
  let companyId: string | null = existingCompany?.id ?? null;
  let testEmail: string | null = null;
  let testPassword: string | null = null;

  if (!existingCompany) {
    testEmail = `mayorista@${input.slug}.demo`;
    testPassword = genDemoPassword();
    let ownerCustomerId: string | undefined;
    try {
      const reg = await authModule.register('emailpass', {
        body: { email: testEmail, password: testPassword },
      });
      if (reg?.success && reg.authIdentity) {
        const { result: customer } = await createCustomerAccountWorkflow(container).run({
          input: {
            authIdentityId: reg.authIdentity.id,
            customerData: {
              email: testEmail,
              first_name: B2B_DEMO_BUYER_FIRST,
              last_name: B2B_DEMO_BUYER_LAST,
            },
          },
        });
        ownerCustomerId = customer.id;
      } else {
        // Email already registered → reuse the existing customer; password unknown.
        const [existing] = await customerService.listCustomers({ email: testEmail });
        ownerCustomerId = existing?.id;
        testPassword = null;
      }
    } catch {
      const [existing] = await customerService.listCustomers({ email: testEmail });
      ownerCustomerId = existing?.id;
      testPassword = null;
    }

    if (ownerCustomerId) {
      try {
        const { result: company } = await createCompanyWorkflow(container).run({
          input: {
            name: B2B_DEMO_COMPANY_NAME,
            slug: companySlug,
            owner_customer_id: ownerCustomerId,
            sales_channel_id: salesChannelId,
            metadata: { demo_id: input.id },
          },
        });
        companyId = company.id;
        if (customerGroupId) {
          await linkCompanyCustomerGroupWorkflow(container).run({
            input: { company_id: company.id, customer_group_id: customerGroupId },
          });
        }
      } catch (err) {
        logger.warn(`[demo-store] B2B company creation skipped: ${(err as Error).message}`);
      }
    }
  }

  logger.info(
    `[demo-store] Provisioned B2B "${input.slug}": sc=${salesChannelId} group=${customerGroupId} company=${companyId}`,
  );

  return { salesChannelId, customerGroupId, companyId, testEmail, testPassword };
}
