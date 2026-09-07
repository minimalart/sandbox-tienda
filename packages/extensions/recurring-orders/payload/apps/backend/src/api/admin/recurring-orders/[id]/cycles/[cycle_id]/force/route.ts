import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { siteFromRequest } from '../../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../../lib/multistore/scope';
import { RECURRING_ORDER_SITE_SCOPE } from '../../../../../../../modules/recurring-order/site-scope';
import { RECURRING_ORDER_MODULE } from '../../../../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../../../../modules/recurring-order/service';
import { runRenewalCycleLocked } from '../../../../../../../workflows/run-renewal-cycle';

/**
 * Fuerza la ejecución de un ciclo desde el admin (ignora el vencimiento).
 * Reusa el mismo workflow que el scheduler; la elegibilidad por estado se
 * valida igual adentro.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  /**
   * El id del PADRE, y guardarlo alcanza porque el chequeo de pertenencia de abajo ya
   * ata el ciclo a esa suscripción: si el padre es de mi tienda y el ciclo es del
   * padre, el ciclo es de mi tienda. No hace falta un descriptor `via_parent` propio.
   *
   * Va ANTES del `retrieveRenewalCycle`, no después: al revés se leería el ciclo de
   * otra tienda para recién entonces decidir que no se podía. El 404 sale igual, pero
   * el orden es la diferencia entre no leerlo y leerlo.
   *
   * De todo el módulo ésta es la única que MUEVE PLATA: `force: true` saltea el
   * vencimiento y dispara el cobro de la renovación. Un ciclo forzado sobre la
   * suscripción de otra tienda le cobra a un cliente que no es de quien apretó.
   */
  await assertIdInSite(req.scope, await siteFromRequest(req), RECURRING_ORDER_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);

  const cycle = await service.retrieveRenewalCycle(req.params.cycle_id as string);
  if (cycle.recurring_order_id !== req.params.id as string) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      'El ciclo no pertenece a esta suscripción.',
    );
  }

  const result = await runRenewalCycleLocked(req.scope, {
    cycleId: cycle.id,
    force: true,
  });

  res.status(200).json({ result });
}
