import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { STORE_CONFIG_MODULE } from '../../../../modules/store-config';
import {
  isFloatingButtonLive,
  readFloatingButtonConfig,
  writeFloatingButtonConfig,
  type StoreSettingWriter,
} from '../../../../modules/kapso-whatsapp/floating-button';
import type { UpdateFloatingButtonInput } from './validators';

import { siteFromRequest } from '../../../../lib/multistore/request';


/** `null` = la fila GLOBAL, el fallback de toda tienda sin config propia. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

/**
 * GET /admin/kapso/floating-button — config actual del botón flotante del
 * storefront. `live` indica si realmente se va a ver en la tienda (activado +
 * teléfono válido), para que el admin pueda avisar cuando falta el número.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<StoreSettingWriter>(STORE_CONFIG_MODULE);
  const floating_button = await readFloatingButtonConfig(service, await siteOf(req));
  res.json({ floating_button, live: isFloatingButtonLive(floating_button) });
}

/** POST /admin/kapso/floating-button — guarda un patch y devuelve la config resultante. */
export async function POST(
  req: MedusaRequest<UpdateFloatingButtonInput>,
  res: MedusaResponse,
): Promise<void> {
  const service = req.scope.resolve<StoreSettingWriter>(STORE_CONFIG_MODULE);
  const floating_button = await writeFloatingButtonConfig(service, req.validatedBody, await siteOf(req));
  res.json({ floating_button, live: isFloatingButtonLive(floating_button) });
}
