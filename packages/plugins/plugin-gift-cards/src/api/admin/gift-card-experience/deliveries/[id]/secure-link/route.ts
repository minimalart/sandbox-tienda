import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { GIFT_CARD_DELIVERY_SITE_SCOPE } from '../../../../../../modules/gift-card-experience/site-scope';
import { decryptGiftCardToken } from '../../../../../../modules/gift-card-experience/crypto';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../../../../modules/gift-card-experience/service';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Mismo guard que el detalle, y acá pesa más que en ninguna otra ruta del
  // recurso: el detalle se cuida de NO devolver `token_encrypted`, y este handler
  // lo desencripta y lo devuelve dentro de la URL del storefront. O sea que sin el
  // guard el id de una entrega ajena no filtra una fila, entrega el token en claro
  // con el que se canjea la gift card de otra tienda. El `auditSecureLink` de abajo
  // deja rastro de quién lo pidió, pero registrar el robo no es impedirlo.
  await assertIdInSite(req.scope, await siteFromRequest(req), GIFT_CARD_DELIVERY_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const delivery = await service.retrieveGiftCardDelivery(req.params.id!);
  const actorId = (req as MedusaRequest & { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? 'admin';
  const configured = process.env.STOREFRONT_URL;
  if (!configured || !delivery.token_encrypted) throw new Error('No se puede generar el enlace seguro.');
  const storefront = new URL(configured);
  if (!['http:', 'https:'].includes(storefront.protocol)) throw new Error('STOREFRONT_URL debe usar HTTP(S).');
  const origin = storefront.origin;
  const countryCode = process.env.DEFAULT_COUNTRY_CODE?.toLowerCase() || 'ar';
  await service.auditSecureLink(delivery as unknown as import('../../../../../../modules/gift-card-experience/types').GiftCardDeliveryRow, actorId);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ url: `${origin}/${countryCode}/gift-card/${encodeURIComponent(decryptGiftCardToken(delivery.token_encrypted))}` });
}
