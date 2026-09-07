import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { STORE_CONFIG_MODULE } from '../../modules/store-config';
import {
  readBotChannelsConfig,
  type StoreSettingReader,
} from '../../modules/kapso-whatsapp/bot-channels';
import { getKapsoSettings } from '../../modules/kapso-whatsapp/settings';

export type WaOrderContext = {
  /**
   * Canal PRINCIPAL: el que se usa para crear el pedido cuando no se puede
   * deducir del carrito. Es el primero de `sales_channel_ids`.
   */
  sales_channel_id: string;
  /**
   * TODOS los canales que atiende el bot, en orden. La búsqueda abarca todos;
   * un pedido pertenece a uno solo (así funciona un carrito en Medusa).
   */
  sales_channel_ids: string[];
  region_id: string;
  currency_code: string;
  country_code: string;
};

/**
 * Resuelve el contexto de orden para una compra por WhatsApp: sales channel +
 * región + moneda + país. Un número de Kapso = un comercio, así que se toma de
 * env con fallback automático (evitando el gotcha de `regions[0]`, que puede ser
 * una región ajena y dejar los precios en null).
 *
 * Prioridad: ajuste explícito de región/país (Admin → WhatsApp → Ajustes, con
 * fallback a `WHATSAPP_REGION_ID` / `WHATSAPP_COUNTRY_CODE`) → resolución por
 * país (región que contiene el país + "Default Sales Channel"). Lanza si no
 * puede resolver una región (el tool que lo usa lo traduce a un mensaje para el
 * cliente).
 */
export async function resolveWaOrderContext(
  container: MedusaContainer,
): Promise<WaOrderContext> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const settings = getKapsoSettings();
  // `WHATSAPP_COUNTRY_CODE` no tiene default en su descriptor justamente para
  // que este encadenado siga vivo: sin él, un default cortaría la herencia de
  // `STOREFRONT_DEFAULT_COUNTRY` en las tiendas que sólo configuran esa.
  const country = (
    settings.countryCode ||
    process.env.STOREFRONT_DEFAULT_COUNTRY ||
    'ar'
  ).toLowerCase();

  // --- Región ---
  const envRegionId = settings.regionId;
  let region: { id: string; currency_code: string } | null = null;
  const { data: regions } = await query.graph({
    entity: 'region',
    fields: ['id', 'currency_code', 'countries.iso_2'],
  });
  if (envRegionId) {
    const r = regions.find((x: any) => x.id === envRegionId);
    if (r) region = { id: r.id, currency_code: r.currency_code };
  }
  if (!region) {
    const r = regions.find((x: any) =>
      (x.countries ?? []).some((c: any) => (c?.iso_2 ?? '').toLowerCase() === country),
    );
    if (r) region = { id: r.id, currency_code: r.currency_code };
  }
  if (!region) {
    throw new Error(
      `No se pudo resolver la región para el país "${country}". ` +
        'Elegí la región del bot en Admin → WhatsApp → Ajustes.',
    );
  }

  // --- Sales channels ---
  //
  // Prioridad: lo elegido en Admin → WhatsApp → Ajustes, después la env (para no
  // romper instalaciones que ya la tenían), y por último el canal por defecto.
  // La config gana porque es la única que el operador puede ver y cambiar sin
  // deploy — el bot ofreciendo el catálogo de otra tienda fue un problema real y
  // nada en la UI lo delataba.
  let channelIds = await readConfiguredChannelIds(container);

  if (channelIds.length === 0) {
    const envScId = process.env.WHATSAPP_SALES_CHANNEL_ID?.trim();
    if (envScId) channelIds = [envScId];
  }

  if (channelIds.length === 0) {
    const { data: channels } = await query.graph({
      entity: 'sales_channel',
      fields: ['id', 'name', 'is_disabled'],
    });
    const enabled = channels.filter((c: any) => !c.is_disabled);
    const preferred =
      enabled.find((c: any) => /default/i.test(c.name ?? '')) ?? enabled[0] ?? channels[0];
    if (preferred?.id) channelIds = [preferred.id];
  }

  if (channelIds.length === 0) {
    throw new Error(
      'No se pudo resolver el canal de venta del bot. Elegilo en Admin → WhatsApp → Ajustes.',
    );
  }

  return {
    sales_channel_id: channelIds[0]!,
    sales_channel_ids: channelIds,
    region_id: region.id,
    currency_code: region.currency_code,
    country_code: country,
  };
}

/**
 * Canales elegidos en Admin → WhatsApp → Ajustes.
 *
 * `store-config` se resuelve por CLAVE y defensivamente: es otra extensión y
 * puede no estar instalada. Sin ella se cae a la env, que es el comportamiento
 * anterior.
 */
async function readConfiguredChannelIds(container: MedusaContainer): Promise<string[]> {
  try {
    const service = container.resolve(STORE_CONFIG_MODULE) as StoreSettingReader;
    const config = await readBotChannelsConfig(service);
    return config.sales_channel_ids;
  } catch {
    return [];
  }
}

/**
 * Canal en el que se tiene que crear el pedido para un conjunto de variantes.
 *
 * Con un solo canal configurado es siempre ése. Con varios importa: un carrito
 * pertenece a UN canal, y si se crea en el canal A con un producto que sólo está
 * en el B, el checkout queda inservible. Se elige el primer canal configurado que
 * contenga TODAS las variantes; si ninguno las tiene todas (carrito mezclado), se
 * devuelve el principal y el llamador decide qué hacer.
 */
export async function resolveOrderSalesChannel(
  container: MedusaContainer,
  variantIds: string[],
  ctx: WaOrderContext,
): Promise<{ sales_channel_id: string; mixed: boolean }> {
  if (ctx.sales_channel_ids.length <= 1 || variantIds.length === 0) {
    return { sales_channel_id: ctx.sales_channel_id, mixed: false };
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: variants } = await query.graph({
    entity: 'product_variant',
    fields: ['id', 'product.sales_channels.id'],
    filters: { id: variantIds },
  });

  const perVariant = (variants ?? []).map(
    (v: any) => new Set(((v?.product?.sales_channels ?? []) as any[]).map((c) => c?.id)),
  );
  for (const channelId of ctx.sales_channel_ids) {
    if (perVariant.length > 0 && perVariant.every((set) => set.has(channelId))) {
      return { sales_channel_id: channelId, mixed: false };
    }
  }
  return { sales_channel_id: ctx.sales_channel_id, mixed: true };
}
