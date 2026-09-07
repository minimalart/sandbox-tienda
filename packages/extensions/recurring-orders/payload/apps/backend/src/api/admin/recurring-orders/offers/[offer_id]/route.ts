import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { RECURRING_ORDER_MODULE } from '../../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../../modules/recurring-order/service';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { RECURRING_OFFER_SITE_SCOPE } from '../../../../../modules/recurring-order/site-scope';

/** Borra un override de descuento por producto. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const offerId = req.params.offer_id as string;

  // El guard va ANTES del `retrieve` de existencia, no después: al revés, el 404 de "no
  // existe" y el 404 del guard salen del mismo lugar igual, pero se habría leído la fila
  // de otra tienda para decidirlo. `assertIdInSite` y no `assertRowInSite` porque el
  // predicado tiene que ser el de `RECURRING_OFFER_SITE_SCOPE` (módulo `recurring-order`),
  // que difiere a propósito del que usa el listado y lo explica allá — escribirlo a mano
  // sobre la fila sería copiarlo por tercera vez.
  await assertIdInSite(req.scope, await siteFromRequest(req), RECURRING_OFFER_SITE_SCOPE, offerId);

  try {
    await service.retrieveRecurringOffer(offerId);
  } catch {
    res.status(404).json({ message: 'Oferta no encontrada.' });
    return;
  }
  await service.deleteRecurringOffers([offerId]);
  res.status(200).json({ id: offerId, deleted: true });
}
