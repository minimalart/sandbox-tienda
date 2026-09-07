import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';
import {
  syncMercadoPagoSubscriptionStatus,
  updateMercadoPagoSubscriptionTerms,
} from '../../../../../modules/recurring-order/payment';
import { ownedRecurringOrder } from '../../utils';
import { withSubscriptionLock } from '../../../../../workflows/run-renewal-cycle';
import { enqueueSubscriptionCommunication } from '../../../../../modules/recurring-order/communications';

const Body = z.object({ card_token_id: z.string().min(8).max(300) });

/** El token viaja una vez a Mercado Pago y jamás se persiste ni se loguea. */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'El token del nuevo medio de pago es inválido.' });
    return;
  }
  await withSubscriptionLock(req.scope, `order:${req.params.id as string}`, async () => {
  const { service, recurringOrder } = await ownedRecurringOrder(req, req.params.id as string);
  if (recurringOrder.payment_mode !== 'mercadopago_auto') {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Esta suscripción no usa cobro automático.',
    );
  }
  const provider = await updateMercadoPagoSubscriptionTerms(req.scope, recurringOrder, {
    cardTokenId: parsed.data.card_token_id,
  });
  let providerStatus = provider?.status ?? recurringOrder.financial_status;
  if (providerStatus === 'authorized') {
    await syncMercadoPagoSubscriptionStatus(req.scope, recurringOrder, 'paused');
    providerStatus = 'paused';
  }
  const [updated] = await service.updateRecurringOrders([{
    id: recurringOrder.id,
    financial_status: providerStatus,
    provider_state: {
      ...(recurringOrder.provider_state ?? {}),
      status: providerStatus,
      next_payment_date: provider?.nextPaymentDate ?? recurringOrder.provider_state?.next_payment_date ?? null,
      payment_method_updated_at: new Date().toISOString(),
    },
  }]);
  const [pastDue] = await service.listRenewalCycles(
    { recurring_order_id: recurringOrder.id, status: 'past_due' },
    { take: 1, order: { scheduled_at: 'ASC' } },
  );
  if (pastDue) {
    await service.updateRenewalCycles([{
      id: pastDue.id,
      scheduled_at: new Date(),
      last_error: null,
      metadata: {
        ...(pastDue.metadata ?? {}),
        payment_method_updated: true,
      },
    }]);
  }
  await service.log({
    recurring_order_id: recurringOrder.id,
    event: 'payment_method_updated',
    actor_type: 'customer',
    actor_id: req.auth_context.actor_id,
  });
  await enqueueSubscriptionCommunication(
    req.scope,
    updated,
    'recurring-order-updated',
    { changed_fields: 'payment_method' },
    `recurring-payment-method-updated:${Date.now()}`,
  );
  res.status(200).json({ updated: true });
  });
}
