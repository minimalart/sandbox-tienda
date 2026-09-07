import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { ERP_MODULE } from '../../../../../../modules/erp';
import type ErpModuleService from '../../../../../../modules/erp/service';

/**
 * POST /admin/erp/outbox-events/:id/retry — reintento manual: failed/
 * dead_letter → pending con intentos reseteados (el processor lo toma en el
 * próximo tick). 400 si el estado no lo permite.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const event = await service.requeueOutboxEvent(req.params.id!);
  logger.info(
    `[erp] retry manual del outbox ${event.id} (${event.event_key}) por ${req.auth_context?.actor_id ?? 'admin'}.`
  );
  res.status(200).json({ outbox_event: event });
}
