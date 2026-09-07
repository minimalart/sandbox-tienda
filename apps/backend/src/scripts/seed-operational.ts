/** Operational seed used by generated projects. It intentionally creates no demo catalog. */
import {
  createApiKeysWorkflow,
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
import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, ModuleRegistrationName, Modules } from '@medusajs/framework/utils';
import fs from 'node:fs';
import path from 'node:path';

function projectConfig() {
  let directory = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    const file = path.join(directory, 'site.project.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')) as any;
    directory = path.dirname(directory);
  }
  return {
    project: { name: 'Mercatto Store', slug: 'mercatto-store' },
    commerce: { country_code: 'ar', currency_code: 'ars', locale: 'es' },
    branding: {}, template: 'grocery', extensions: [],
  };
}

function writeStorefrontRuntime(salesChannelId: string, publishableKey: string) {
  let directory = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    const file = path.join(directory, 'apps', 'storefront', '.env.local');
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      const values = { NEXT_PUBLIC_SALES_CHANNEL_ID: salesChannelId, NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: publishableKey };
      for (const [key, value] of Object.entries(values)) {
        const expression = new RegExp(`^${key}=.*$`, 'm');
        content = expression.test(content) ? content.replace(expression, `${key}=${value}`) : `${content.trimEnd()}\n${key}=${value}\n`;
      }
      fs.writeFileSync(file, content);
      return;
    }
    const parent = path.dirname(directory); if (parent === directory) break; directory = parent;
  }
}

export default async function seedOperational({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const config = projectConfig();
  const country = String(config.commerce.country_code).toLowerCase();
  const currency = String(config.commerce.currency_code).toLowerCase();
  const stores: any = container.resolve(ModuleRegistrationName.STORE);
  const channels: any = container.resolve(ModuleRegistrationName.SALES_CHANNEL);
  const regions: any = container.resolve(ModuleRegistrationName.REGION);
  const locations: any = container.resolve(ModuleRegistrationName.STOCK_LOCATION);
  const fulfillment: any = container.resolve(ModuleRegistrationName.FULFILLMENT);
  const [store] = await stores.listStores({}, { relations: ['supported_currencies'] });
  if (!store) throw new Error('Medusa store has not been initialized');

  let [channel] = await channels.listSalesChannels({ name: 'Online Store' });
  if (!channel) {
    const { result } = await createSalesChannelsWorkflow(container).run({ input: { salesChannelsData: [{ name: 'Online Store' }] } });
    channel = result[0];
  }
  const supported = (store.supported_currencies ?? []).map((item: any) => ({
    currency_code: item.currency_code,
    is_default: item.currency_code === currency,
  }));
  if (!supported.some((item: any) => item.currency_code === currency)) {
    supported.push({ currency_code: currency, is_default: true });
  }
  await updateStoresWorkflow(container).run({ input: { selector: { id: store.id }, update: {
    name: config.project.name,
    supported_currencies: supported,
    default_sales_channel_id: channel.id,
  } } });

  const existingRegions = await regions.listRegions({}, { relations: ['countries'] });
  let region = existingRegions.find((item: any) => item.countries?.some((entry: any) => entry.iso_2 === country));
  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({ input: { regions: [{
      name: country.toUpperCase(), currency_code: currency, countries: [country], payment_providers: ['pp_system_default'],
    }] } });
    region = result[0];
    await createTaxRegionsWorkflow(container).run({ input: [{ country_code: country, provider_id: 'tp_system' }] });
  }

  let [location] = await locations.listStockLocations({ name: 'Main Warehouse' });
  if (!location) {
    const { result } = await createStockLocationsWorkflow(container).run({ input: { locations: [{
      name: 'Main Warehouse', address: { country_code: country.toUpperCase(), city: '', address_1: '' },
    }] } });
    location = result[0];
    await link.create({ [Modules.STOCK_LOCATION]: { stock_location_id: location.id }, [Modules.FULFILLMENT]: { fulfillment_provider_id: 'manual_manual' } });
    await linkSalesChannelsToStockLocationWorkflow(container).run({ input: { id: location.id, add: [channel.id] } });
  }

  let [profile] = await fulfillment.listShippingProfiles({ name: 'Default' });
  if (!profile) {
    const { result } = await createShippingProfilesWorkflow(container).run({ input: { data: [{ name: 'Default', type: 'default' }] } });
    profile = result[0];
  }
  let [set] = await fulfillment.listFulfillmentSets({ name: 'Main Warehouse delivery' }, { relations: ['service_zones'] });
  if (!set) {
    set = await fulfillment.createFulfillmentSets({ name: 'Main Warehouse delivery', type: 'shipping', service_zones: [{
      name: country.toUpperCase(), geo_zones: [{ country_code: country, type: 'country' }],
    }] });
    await link.create({ [Modules.STOCK_LOCATION]: { stock_location_id: location.id }, [Modules.FULFILLMENT]: { fulfillment_set_id: set.id } });
    const zone = set.service_zones?.[0];
    if (zone) await createShippingOptionsWorkflow(container).run({ input: [{
      name: 'Standard Shipping', price_type: 'flat', provider_id: 'manual_manual',
      service_zone_id: zone.id, shipping_profile_id: profile.id,
      type: { label: 'Standard', description: 'Standard delivery', code: `standard-${country}` },
      prices: [{ currency_code: currency, amount: 0 }, { region_id: region.id, amount: 0 }],
      rules: [{ attribute: 'enabled_in_store', value: 'true', operator: 'eq' }, { attribute: 'is_return', value: 'false', operator: 'eq' }],
    }] });
  }

  const apiKeys: any = container.resolve(Modules.API_KEY);
  let [apiKey] = await apiKeys.listApiKeys({ type: 'publishable' });
  if (!apiKey) {
    const { result } = await createApiKeysWorkflow(container).run({ input: { api_keys: [{ title: 'Storefront', type: 'publishable', created_by: '' }] } });
    apiKey = result[0];
  }
  await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: apiKey.id, add: [channel.id] } });
  writeStorefrontRuntime(channel.id, apiKey.token ?? apiKey.id);

  // Config de comercio de la instancia. Antes esto sembraba seis namespaces de
  // site-manager (project, branding, content, extensions, template:<id> y commerce);
  // los cinco primeros no tenían un solo lector fuera de su propia UI, así que se
  // fueron con esa extensión. Lo que sobrevive es `commerce`, ahora en store_setting.
  //
  // `store-config` es una extensión OPCIONAL: si no está instalada, el seed no falla
  // — sólo no persiste esta preferencia (los recursos de Medusa ya quedaron creados).
  try {
    const storeConfig: any = container.resolve('storeConfig');
    await storeConfig.upsertSetting('commerce_config', config.commerce);
  } catch {
    logger.info('store-config no está instalado: se omite la preferencia de comercio.');
  }
  logger.info(`Operational seed complete. Publishable key: ${apiKey.token ?? apiKey.id}`);
}
