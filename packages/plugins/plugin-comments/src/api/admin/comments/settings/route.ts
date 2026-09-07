import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { COMMENTS_MODULE } from '../../../../modules/comments';
import type CommentsModuleService from '../../../../modules/comments/service';
import type { AdminUpdateCommentSettingsType } from '../validators';

import { siteFromRequest } from '../../../../lib/multistore/request';


/** `null` = la fila GLOBAL, el fallback de toda tienda sin config propia. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

// GET /admin/comments/settings — read the global config.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const service = req.scope.resolve<CommentsModuleService>(COMMENTS_MODULE);
  const settings = await service.getSettings(await siteOf(req));
  res.status(200).json({ settings });
}

// POST /admin/comments/settings — update the global config.
export async function POST(
  req: MedusaRequest<AdminUpdateCommentSettingsType>,
  res: MedusaResponse,
): Promise<void> {
  const service = req.scope.resolve<CommentsModuleService>(COMMENTS_MODULE);
  /**
   * `upsertSettingsForSite` y no `updateSettings`: si la tienda no tiene fila propia,
   * el GET devuelve la GLOBAL, y actualizar esa fila por su id escribiría la
   * configuración de la instancia entera creyendo editar una sola tienda.
   */
  const settings = await service.upsertSettingsForSite(await siteOf(req), req.validatedBody as Record<string, unknown>);
  res.status(200).json({ settings });
}
