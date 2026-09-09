import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';
import { DEMO_STORE_MODULE } from './index';
import { provisionDemoB2B } from './provision';
import { provisionDemoB2BPricing, WHOLESALE_TIERS } from './b2b-pricing';

type Selection = { b2b_sales_channel_id?: string | null; b2b_price_list_id?: string | null };
const invalid = (message: string): never => {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message);
};

/** Resumable setup: persist resource IDs as they succeed, enable only at completion. */
export async function configureStoreB2B(
  container: any,
  store: any,
  selection: Selection,
  operations = { provision: provisionDemoB2B, pricing: provisionDemoB2BPricing }
) {
  const service = container.resolve(DEMO_STORE_MODULE);
  const channelId =
    selection.b2b_sales_channel_id === undefined
      ? store.b2b_sales_channel_id
      : selection.b2b_sales_channel_id;
  const priceListId =
    selection.b2b_price_list_id === undefined
      ? store.b2b_price_list_id
      : selection.b2b_price_list_id;
  if (!store.sales_channel_id || !store.region_id)
    invalid('Asigná un canal de catálogo y una región antes de habilitar B2B.');
  if (channelId === store.sales_channel_id)
    invalid('El canal mayorista debe ser distinto del canal de catálogo.');
  // A selected resource cannot belong to another site, including a retail channel.
  for (const [field, value] of [
    ['b2b_sales_channel_id', channelId],
    ['b2b_price_list_id', priceListId],
  ]) {
    if (!value) continue;
    const owners = await service.listDemoStores(
      field === 'b2b_sales_channel_id'
        ? { $or: [{ sales_channel_id: value }, { b2b_sales_channel_id: value }] }
        : { [field]: value }
    );
    if (owners.some((owner: any) => owner.id !== store.id))
      invalid('El recurso mayorista seleccionado pertenece a otra tienda.');
  }
  if (channelId) await container.resolve(Modules.SALES_CHANNEL).retrieveSalesChannel(channelId);
  if (priceListId) await container.resolve(Modules.PRICING).retrievePriceList(priceListId);
  let stockLocationId = store.stock_location_id;
  if (!stockLocationId) {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: 'stock_location',
      fields: ['id', 'sales_channels.id'],
      pagination: { take: 1000 },
    });
    const linked = data.filter((location: any) =>
      location.sales_channels?.some((sc: any) => sc.id === store.sales_channel_id)
    );
    if (linked.length !== 1)
      invalid('Seleccioná el depósito de la tienda para configurar el canal mayorista.');
    stockLocationId = linked[0].id;
  }
  await service.updateDemoStores({ id: store.id, b2b_enabled: false });
  const b2b = await operations.provision(container, {
    id: store.id,
    name: store.name,
    slug: store.slug,
    regionId: store.region_id,
    stockLocationId,
    salesChannelId: channelId,
    sourceSalesChannelId: store.sales_channel_id,
    customerGroupId: store.b2b_customer_group_id,
  });
  if (!b2b.customerGroupId)
    invalid('No se pudo crear el grupo de clientes mayoristas. Volvé a guardar para reintentar.');
  await service.updateDemoStores({
    id: store.id,
    b2b_sales_channel_id: b2b.salesChannelId,
    b2b_sales_channel_owned:
      !channelId ||
      (channelId === store.b2b_sales_channel_id && store.b2b_sales_channel_owned !== false),
    b2b_customer_group_id: b2b.customerGroupId,
    b2b_company_id: b2b.companyId,
    ...(b2b.testEmail
      ? { b2b_test_email: b2b.testEmail, b2b_test_password: b2b.testPassword }
      : {}),
  });
  const pricing = await operations.pricing(container, {
    demoSlug: store.slug,
    sourceSalesChannelId: store.sales_channel_id,
    b2bSalesChannelId: b2b.salesChannelId,
    customerGroupId: b2b.customerGroupId,
    currencyCode: store.currency_code,
    regionId: store.region_id,
    priceListId,
  });
  if (!pricing.priceListId)
    invalid('No se pudo configurar la lista mayorista. Volvé a guardar para reintentar.');
  return service.updateDemoStores({
    id: store.id,
    b2b_enabled: true,
    b2b_price_list_id: pricing.priceListId,
    b2b_price_list_owned:
      !priceListId ||
      (priceListId === store.b2b_price_list_id && store.b2b_price_list_owned !== false),
    b2b_pricing_tiers: priceListId
      ? priceListId === store.b2b_price_list_id
        ? (store.b2b_pricing_tiers ?? WHOLESALE_TIERS.map((t) => ({ ...t })))
        : []
      : WHOLESALE_TIERS.map((t) => ({ ...t })),
  });
}
