import { isSubscriptionFeatureEnabled } from '../../../../../modules/recurring-order/settings';
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { ownedRecurringOrder } from '../../utils';
import {
  normalizeRetention,
  resolveRetentionOffer,
} from '../../../../../modules/recurring-order/retention';
import {
  pauseRecurringOrderSafely,
  skipNextRecurringOrderDelivery,
} from '../../../../../modules/recurring-order/actions';
import { withSubscriptionLock } from '../../../../../workflows/run-renewal-cycle';

const Body = z.object({
  action: z.enum(['pause', 'skip', 'discount']),
  reason: z.enum(['precio', 'no_lo_necesito', 'problemas_entrega', 'otro']).nullish(),
  reason_note: z.string().max(500).nullish(),
});

/**
 * POST /store/recurring-orders/:id/retention — el cliente venía a cancelar
 * pero aceptó una alternativa: pausar, omitir la próxima, o quedarse con el
 * descuento de retención del canal. Registra el case con el desenlace.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  if (!isSubscriptionFeatureEnabled('SUBSCRIPTIONS_RETENTION_ENABLED')) {
    res.status(404).json({ message: 'Las ofertas de retención no están habilitadas.' });
    return;
  }
  const parsed = Body.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  await withSubscriptionLock(req.scope, `order:${req.params.id as string}`, async () => {
    const { service, recurringOrder } = await ownedRecurringOrder(req, req.params.id as string);
    if (!['active', 'pending_payment', 'paused'].includes(recurringOrder.status)) {
      res.status(400).json({ message: 'La suscripción no admite esta acción.' });
      return;
    }

    const { action, reason, reason_note: reasonNote } = parsed.data;
    const now = new Date();
    let caseStatus: 'paused' | 'skipped' | 'retained';
    let retentionOffer: { percentage: number; cycles: number } | null = null;
    let authorizationUrl: string | null = null;

    if (action === 'pause') {
      await pauseRecurringOrderSafely(req.scope, service, recurringOrder);
      caseStatus = 'paused';
    } else if (action === 'skip') {
      const skipped = await skipNextRecurringOrderDelivery(req.scope, service, recurringOrder);
      authorizationUrl = skipped.authorizationUrl;
      caseStatus = 'skipped';
    } else {
      // Descuento de retención: tiene que estar configurado para el canal.
      retentionOffer = await resolveRetentionOffer(req.scope, recurringOrder.sales_channel_id);
      if (!retentionOffer) {
        res.status(400).json({ message: 'No hay una oferta de retención disponible.' });
        return;
      }
      await service.updateRecurringOrders([
        {
          id: recurringOrder.id,
          metadata: {
            ...(recurringOrder.metadata ?? {}),
            retention: {
              percentage: retentionOffer.percentage,
              remaining_cycles: retentionOffer.cycles,
            },
          },
        },
      ]);
      caseStatus = 'retained';
    }

    try {
      await service.createCancellationCases([
        {
          recurring_order_id: recurringOrder.id,
          status: caseStatus,
          reason: reason ?? null,
          reason_note: reasonNote ?? null,
          retention_offer: retentionOffer,
          decided_at: now,
        },
      ]);
    } catch {
      // Registro best-effort.
    }
    await service.log({
      recurring_order_id: recurringOrder.id,
      event: 'retention_accepted',
      actor_type: 'customer',
      actor_id: req.auth_context.actor_id,
      data: { action, reason: reason ?? null, retention_offer: retentionOffer },
    });

    const updated = await service.retrieveRecurringOrder(recurringOrder.id);
    res.status(200).json({
      recurring_order: updated,
      retention_offer: normalizeRetention(retentionOffer),
      ...(authorizationUrl ? { authorization_url: authorizationUrl } : {}),
    });
  });
}
