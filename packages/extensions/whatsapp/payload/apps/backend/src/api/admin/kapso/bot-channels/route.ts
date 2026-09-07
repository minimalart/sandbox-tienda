import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { STORE_CONFIG_MODULE } from '../../../../modules/store-config';
import {
  readBotChannelsConfig,
  writeBotChannelsConfig,
  type StoreSettingWriter,
} from '../../../../modules/kapso-whatsapp/bot-channels';
import type { UpdateBotChannelsInput } from './validators';

import { siteFromRequest } from '../../../../lib/multistore/request';


/** `null` = la fila GLOBAL, el fallback de toda tienda sin config propia. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

type AnyRecord = Record<string, any>;

/** Canales disponibles para elegir, más el nombre de los ya seleccionados. */
async function listChannels(req: MedusaRequest): Promise<AnyRecord[]> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: 'sales_channel',
    fields: ['id', 'name', 'is_disabled'],
  });
  return (data ?? []) as AnyRecord[];
}

/**
 * GET /admin/kapso/bot-channels — canales del bot + el catálogo de canales para
 * el selector.
 *
 * `env_fallback` dice qué canal se está usando HOY si la lista está vacía: sin
 * eso, el operador no tiene forma de saber a qué catálogo le está hablando el bot
 * (que fue exactamente el problema: ofrecía productos de otra tienda).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<StoreSettingWriter>(STORE_CONFIG_MODULE);
  const config = await readBotChannelsConfig(service, await siteOf(req));
  const channels = await listChannels(req);

  res.json({
    bot_channels: config,
    channels: channels.map((c) => ({
      id: c.id as string,
      name: (c.name as string) ?? '',
      is_disabled: c.is_disabled === true,
    })),
    env_fallback: process.env.WHATSAPP_SALES_CHANNEL_ID?.trim() || null,
    configured: config.sales_channel_ids.length > 0,
  });
}

/** POST /admin/kapso/bot-channels — guarda la lista completa (ordenada). */
export async function POST(
  req: MedusaRequest<UpdateBotChannelsInput>,
  res: MedusaResponse,
): Promise<void> {
  const service = req.scope.resolve<StoreSettingWriter>(STORE_CONFIG_MODULE);
  const known = new Set((await listChannels(req)).map((c) => c.id as string));

  // Se descartan ids que no existen: un canal borrado en la lista dejaría al bot
  // filtrando por un canal fantasma y devolviendo cero productos para siempre.
  const requested = req.validatedBody.sales_channel_ids ?? [];
  const valid = requested.filter((id) => known.has(id));
  const dropped = requested.filter((id) => !known.has(id));

  const bot_channels = await writeBotChannelsConfig(service, { sales_channel_ids: valid }, await siteOf(req));
  res.json({ bot_channels, dropped, configured: bot_channels.sales_channel_ids.length > 0 });
}
