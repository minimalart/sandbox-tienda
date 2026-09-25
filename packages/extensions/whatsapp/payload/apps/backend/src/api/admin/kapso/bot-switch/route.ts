import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { STORE_CONFIG_MODULE } from '../../../../modules/store-config';
import {
  readBotSwitch,
  writeBotSwitch,
  type StoreSettingWriter,
} from '../../../../modules/kapso-whatsapp/bot-switch';
import { WHATSAPP_FLOW_MODULE } from '../../../../modules/whatsapp-flow';
import type WhatsappFlowModuleService from '../../../../modules/whatsapp-flow/service';
import { DEFAULT_FLOW_KEY } from '../../../../modules/whatsapp-flow/types';
import type { UpdateBotSwitchInput } from './validators';

/** `null` = la fila GLOBAL, el fallback de toda tienda sin config propia. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

/**
 * Qué recorrido está publicado, si hay alguno. Se mira acá y no en otra pantalla
 * porque son las DOS palancas del mismo número y confundirlas sale caro: apagar el
 * bot deja el recorrido publicado —listo para volver a atender en cuanto se prenda—,
 * y despublicar el recorrido NO apaga el bot. La card lo dice con esto en la mano.
 *
 * Defensivo: el módulo de recorridos es de otra extensión y puede no estar.
 */
async function activeFlowSummary(
  req: MedusaRequest,
  siteId: string | null,
): Promise<{ id: string; name: string | null; version: number } | null> {
  try {
    const service = req.scope.resolve(WHATSAPP_FLOW_MODULE) as WhatsappFlowModuleService;
    const active = await service.getActiveVersion(DEFAULT_FLOW_KEY, siteId);
    return active ? { id: active.id, name: active.name, version: active.version } : null;
  } catch {
    return null;
  }
}

/** GET /admin/kapso/bot-switch — si el bot contesta, y qué recorrido hay publicado. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<StoreSettingWriter>(STORE_CONFIG_MODULE);
  const siteId = await siteOf(req);
  res.json({
    bot_switch: await readBotSwitch(service, siteId),
    active_flow: await activeFlowSummary(req, siteId),
    /**
     * A QUÉ ÁMBITO escribe esta pantalla. Sin esto el operador no puede saber si está
     * apagando el bot de una tienda o el de todas — y el ámbito lo decide la tienda
     * activa del backoffice, que vive en otra pantalla.
     */
    site_id: siteId,
  });
}

/** POST /admin/kapso/bot-switch — prende o apaga el bot de esta tienda. */
export async function POST(
  req: MedusaRequest<UpdateBotSwitchInput>,
  res: MedusaResponse,
): Promise<void> {
  const service = req.scope.resolve<StoreSettingWriter>(STORE_CONFIG_MODULE);
  const siteId = await siteOf(req);
  const bot_switch = await writeBotSwitch(
    service,
    { enabled: req.validatedBody.enabled, note: req.validatedBody.note ?? null },
    siteId,
  );
  res.json({ bot_switch, active_flow: await activeFlowSummary(req, siteId), site_id: siteId });
}
