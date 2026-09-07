import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../lib/multistore/request';
import type { z } from 'zod';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../../modules/gift-card-experience/service';
import { GiftCardSettingsUpdate } from '../validators';

type Input = z.infer<typeof GiftCardSettingsUpdate>;

/** `null` = la fila GLOBAL, que es el fallback de toda tienda sin configuración propia. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  res.json({ settings: await service.getSettings(await siteOf(req)) });
}

export async function POST(req: MedusaRequest<Input>, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const actorId = (req as MedusaRequest & { auth_context?: { actor_id?: string } }).auth_context?.actor_id;
  const input = req.validatedBody as Input;

  /**
   * `upsertSettingsForSite` y no `updateGiftCardSettings` sobre la fila que devolvió
   * el GET: si la tienda todavía no tiene fila propia, el GET devuelve la GLOBAL, y
   * actualizar esa fila por su id escribiría la configuración de la instancia entera
   * creyendo estar editando una sola tienda.
   */
  const settings = await service.upsertSettingsForSite(await siteOf(req), {
    ...input,
    ...(input.retry_delays_minutes ? { retry_delays_minutes: { delays: input.retry_delays_minutes } } : {}),
    updated_by: actorId,
  });
  res.json({ settings });
}
