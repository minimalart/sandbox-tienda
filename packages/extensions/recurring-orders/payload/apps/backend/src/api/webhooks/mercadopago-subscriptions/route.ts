import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  completeCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  deleteReservationsWorkflow,
} from '@medusajs/medusa/core-flows';
import { MercadoPagoConfig, Payment, PaymentRefund, PreApproval } from 'mercadopago';
import { MERCADO_PAGO_API_PROVIDER_ID } from '../../../modules/mercado-pago-api/constants';
import { verifyMpWebhookSignature } from '../../../modules/mercado-pago/utils/webhook-verifier';
import { RECURRING_ORDER_MODULE } from '../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../modules/recurring-order/service';
import {
  cancelMercadoPagoSubscriptionById,
  resolveMercadoPagoSubscriptionAccount,
  rotateMercadoPagoSubscription,
  syncMercadoPagoSubscriptionStatus,
} from '../../../modules/recurring-order/payment/mercadopago-auto';
import { withSubscriptionLock } from '../../../workflows/run-renewal-cycle';
import { getKapsoSettings } from '../../../modules/kapso-whatsapp/settings';
import { enqueueSubscriptionCommunication } from '../../../modules/recurring-order/communications';
import { releaseRecurringOrderReservations } from '../../../modules/recurring-order/inventory-reservations';
import { buildManageUrl } from '../../../modules/recurring-order/lib';
import { classifyMercadoPagoRejection } from '../../../modules/recurring-order/payment/rejections';

type WebhookBody = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

const reservationIdsFrom = (value: unknown): string[] => {
  const candidate = Array.isArray(value)
    ? value
    : Array.isArray((value as { ids?: unknown[] } | null)?.ids)
      ? (value as { ids: unknown[] }).ids
      : [];
  return candidate.filter((id: unknown): id is string => typeof id === 'string');
};

const hasValidReservationState = (value: unknown): boolean =>
  reservationIdsFrom(value).length > 0 ||
  (value as { not_required?: unknown } | null)?.not_required === true;

const parseReference = (value: unknown): { orderId: string; cycleId: string } | null => {
  const [orderId, cycleId, extra] = String(value ?? '').split(':');
  if (!orderId?.startsWith('rord_') || !cycleId?.startsWith('rcyc_') || extra) return null;
  return { orderId, cycleId };
};

async function recordPaymentFailure(
  container: MedusaContainer,
  service: RecurringOrderModuleService,
  recurringOrder: any,
  cycle: any,
  paymentId: string,
  reason: string,
): Promise<void> {
  const now = new Date();
  const attempts = Number(cycle.attempt_count ?? 0) + 1;
  const snapshot = recurringOrder.plan_snapshot as {
    payment_retry_hours?: number;
    payment_retry_interval_hours?: number;
  } | null;
  const retryWindowHours = Number(snapshot?.payment_retry_hours ?? 72);
  const retryBaseHours = Number(snapshot?.payment_retry_interval_hours ?? 6);
  const retryUntil = cycle.retry_until
    ? new Date(cycle.retry_until)
    : new Date(now.getTime() + retryWindowHours * 60 * 60 * 1000);
  if (recurringOrder.financial_status !== 'paused') {
    try {
      await syncMercadoPagoSubscriptionStatus(container, recurringOrder, 'paused');
      recurringOrder.financial_status = 'paused';
    } catch (pauseError) {
      await service.upsertAlert({
        dedupe_key: `payment-provider-pause:${cycle.id}`,
        sales_channel_id: recurringOrder.sales_channel_id,
        recurring_order_id: recurringOrder.id,
        renewal_cycle_id: cycle.id,
        type: 'payment',
        severity: 'critical',
        title: 'No se pudo pausar el cobro rechazado',
        message: (pauseError as Error).message,
        data: { provider_payment_id: paymentId, detected_at: now.toISOString() },
      });
      throw pauseError;
    }
  }
  if (now >= retryUntil) {
    await releaseRecurringOrderReservations(container, recurringOrder.id);
    await service.skipCycle(cycle.id, 'payment-retries-exhausted', { scheduleNext: true }, now);
    const [updated] = await service.updateRecurringOrders([{
      id: recurringOrder.id,
      financial_status: 'paused',
      consecutive_failures: Number(recurringOrder.consecutive_failures ?? 0) + 1,
      provider_state: {
        ...(recurringOrder.provider_state ?? {}),
        status: 'paused',
        schedule_reauthorization_required: true,
        schedule_reauthorization_reason: 'payment-retries-exhausted',
      },
    }]);
    const refreshed = updated ?? await service.retrieveRecurringOrder(recurringOrder.id);
    const [nextCycle] = await service.listRenewalCycles(
      { recurring_order_id: recurringOrder.id, status: 'scheduled' },
      { take: 1, order: { scheduled_at: 'ASC' } },
    );
    if (nextCycle) {
      try {
        const rotation = await rotateMercadoPagoSubscription(container, refreshed, {
          interval: refreshed.frequency_interval,
          count: refreshed.frequency_count,
          nextPaymentAt: new Date(nextCycle.scheduled_at),
          cycleId: nextCycle.id,
        });
        await service.updateRecurringOrders([{
          id: refreshed.id,
          external_subscription_id: rotation.externalSubscriptionId,
          financial_status: 'pending_authorization',
          provider_state: rotation.providerState,
          payment_context: {
            ...(refreshed.payment_context ?? {}),
            provider: 'mercado_pago',
            preapproval_id: rotation.externalSubscriptionId,
          },
        }]);
        await service.updateRenewalCycles([{
          id: nextCycle.id,
          status: 'awaiting_authorization',
          confirmation_url: rotation.authorizationUrl,
          payment_status: 'pending',
        }]);
      } catch (rotationError) {
        await service.upsertAlert({
          dedupe_key: `payment-rotation:${nextCycle.id}`,
          sales_channel_id: recurringOrder.sales_channel_id,
          recurring_order_id: recurringOrder.id,
          renewal_cycle_id: nextCycle.id,
          type: 'payment',
          severity: 'critical',
          title: 'La próxima agenda necesita reautorización',
          message: (rotationError as Error).message,
          data: { detected_at: now.toISOString() },
        });
      }
    }
    return;
  }
  const backoffHours = Math.min(24, retryBaseHours * 2 ** Math.max(0, attempts - 1));
  const rejectionClass = classifyMercadoPagoRejection(reason);
  const retryAt = rejectionClass === 'definitive'
    ? retryUntil
    : new Date(now.getTime() + backoffHours * 60 * 60 * 1000);
  await service.updateRenewalCycles([{
    id: cycle.id,
    status: 'past_due',
    payment_status: 'failed',
    provider_payment_id: paymentId,
    last_error: reason,
    processed_at: null,
    attempt_count: attempts,
    retry_until: retryUntil,
    scheduled_at: retryAt,
    metadata: {
      ...(cycle.metadata ?? {}),
      rejection_class: rejectionClass,
      rejection_detail: reason,
    },
  }]);
  await service.updateRecurringOrders([{
    id: recurringOrder.id,
    status: 'active',
    financial_status: 'past_due',
    consecutive_failures: Number(recurringOrder.consecutive_failures ?? 0) + 1,
  }]);
  await service.upsertAlert({
    dedupe_key: `payment-failed:${cycle.id}`,
    sales_channel_id: recurringOrder.sales_channel_id,
    recurring_order_id: recurringOrder.id,
    renewal_cycle_id: cycle.id,
    type: 'payment',
    severity: 'warning',
    title: 'Cobro recurrente rechazado',
    message: reason,
    data: { provider_payment_id: paymentId, detected_at: now.toISOString() },
  });
  if (recurringOrder.email) {
    await service.enqueueNotification({
      dedupe_key: `payment-failed-email:${paymentId}`,
      recurring_order_id: recurringOrder.id,
      renewal_cycle_id: cycle.id,
      sales_channel_id: recurringOrder.sales_channel_id,
      channel: 'email',
      recipient: recurringOrder.email,
      template: 'recurring-payment-failed',
      data: {
        sales_channel_id: recurringOrder.sales_channel_id,
        recurring_order_id: recurringOrder.id,
        cycle_id: cycle.id,
        manage_url: buildManageUrl(recurringOrder.country_code),
      },
    });
  }
  if (
    getKapsoSettings().templates.recurringPaymentFailed &&
    recurringOrder.phone &&
    (recurringOrder.metadata as { whatsapp_consent?: boolean } | null)?.whatsapp_consent
  ) {
    await service.enqueueNotification({
      dedupe_key: `payment-failed-whatsapp:${paymentId}`,
      recurring_order_id: recurringOrder.id,
      renewal_cycle_id: cycle.id,
      sales_channel_id: recurringOrder.sales_channel_id,
      channel: 'whatsapp',
      recipient: recurringOrder.phone,
      template: 'recurring-payment-failed',
      data: {
        sales_channel_id: recurringOrder.sales_channel_id,
        recurring_order_id: recurringOrder.id,
        cycle_id: cycle.id,
        manage_url: buildManageUrl(recurringOrder.country_code),
      },
    });
  }
}

/** Webhook financiero autoritativo para preapprovals y sus pagos. */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const body = (req.body ?? {}) as WebhookBody;
  const dataId = body.data?.id == null ? null : String(body.data.id);
  const topic = body.type ?? (req.query.topic as string | undefined) ?? '';
  if (!dataId || !['payment', 'subscription_preapproval', 'preapproval'].includes(topic)) {
    res.sendStatus(200);
    return;
  }

  const salesChannelId = (req.query.sc as string | undefined) || null;
  const account = await resolveMercadoPagoSubscriptionAccount(req.scope, salesChannelId);
  if (!account.accessToken || !account.webhookSecret) {
    logger.error('[Subscriptions V2] webhook rechazado: faltan credenciales o firma HMAC.');
    res.sendStatus(503);
    return;
  }
  const signature = verifyMpWebhookSignature({
    secret: account.webhookSecret,
    xSignature: req.headers['x-signature'] as string | undefined,
    xRequestId: req.headers['x-request-id'] as string | undefined,
    dataId,
  });
  if (!signature.valid) {
    res.sendStatus(401);
    return;
  }

  const client = new MercadoPagoConfig({ accessToken: account.accessToken });
  if (topic !== 'payment') {
    const external = await new PreApproval(client).get({ id: dataId });
    const ref = parseReference(external.external_reference);
    if (!ref) {
      res.sendStatus(200);
      return;
    }
    const recurringOrder: any = await service.retrieveRecurringOrder(ref.orderId);
    if (salesChannelId && recurringOrder.sales_channel_id !== salesChannelId) {
      res.sendStatus(401);
      return;
    }
    // Un preapproval reemplazado puede emitir su último webhook de cancelación.
    // La firma/cuenta ya fueron verificadas: se ignora sin mutar el contrato.
    if (recurringOrder.external_subscription_id !== dataId) {
      res.sendStatus(200);
      return;
    }
    const status = String(external.status ?? 'pending');
    const referencedCycle: any = await service.retrieveRenewalCycle(ref.cycleId);
    const safeForCharge =
      referencedCycle.recurring_order_id === recurringOrder.id &&
      Boolean(referencedCycle.quote_hash) &&
      hasValidReservationState(referencedCycle.inventory_reservation_ids) &&
      ['inventory_reserved', 'awaiting_charge', 'past_due'].includes(referencedCycle.status);
    let effectiveStatus = status;
    // Una autorización recién otorgada queda pausada hasta que el preflight
    // cierre cotización y reserva. Así ni una caída del cron deja una canasta
    // expuesta a cobro sin stock bloqueado.
    if (status === 'authorized' && !safeForCharge) {
      await new PreApproval(client).update({
        id: dataId,
        body: { status: 'paused' },
        requestOptions: { idempotencyKey: `subscription-safety-pause:${ref.cycleId}` },
      });
      effectiveStatus = 'paused';
    }
    const providerState = (recurringOrder.provider_state ?? {}) as Record<string, unknown>;
    const previousSubscriptionId = typeof providerState.previous_subscription_id === 'string'
      ? providerState.previous_subscription_id
      : null;
    if (status === 'authorized' && previousSubscriptionId) {
      try {
        await cancelMercadoPagoSubscriptionById(req.scope, recurringOrder, previousSubscriptionId);
      } catch (cancelError) {
        await service.upsertAlert({
          dedupe_key: `provider-replaced-cancel:${previousSubscriptionId}`,
          sales_channel_id: recurringOrder.sales_channel_id,
          recurring_order_id: recurringOrder.id,
          renewal_cycle_id: ref.cycleId,
          type: 'payment',
          severity: 'critical',
          title: 'No se pudo cancelar la autorización reemplazada',
          message: (cancelError as Error).message,
          data: { replacement_id: dataId, detected_at: new Date().toISOString() },
        });
        res.sendStatus(500);
        return;
      }
    }
    await service.updateRecurringOrders([{
      id: recurringOrder.id,
      financial_status: effectiveStatus,
      provider_state: {
        ...providerState,
        status: effectiveStatus,
        next_payment_date: external.next_payment_date ?? null,
        ...(status === 'authorized' ? {
          authorization_url: null,
          previous_subscription_id: null,
          previous_subscription_status: null,
          schedule_reauthorization_required: false,
          rotation_cycle_id: null,
        } : {}),
        synced_at: new Date().toISOString(),
      },
    }]);
    if (status === 'authorized') {
      if (
        referencedCycle.recurring_order_id === recurringOrder.id &&
        referencedCycle.status === 'awaiting_authorization'
      ) {
        await service.updateRenewalCycles([{
          id: referencedCycle.id,
          status: 'scheduled',
          confirmation_url: null,
          last_error: null,
          metadata: {
            ...(referencedCycle.metadata ?? {}),
            authorization_pending: false,
            authorized_at: new Date().toISOString(),
          },
        }]);
      }
    }
    await service.log({
      recurring_order_id: recurringOrder.id,
      event: 'provider_subscription_synced',
      data: { provider_status: status, effective_status: effectiveStatus, safe_for_charge: safeForCharge },
    });
    res.sendStatus(200);
    return;
  }

  const payment: any = await new Payment(client).get({ id: dataId });
  const ref = parseReference(payment.external_reference);
  if (!ref) {
    res.sendStatus(200);
    return;
  }
  const recurringOrder: any = await service.retrieveRecurringOrder(ref.orderId);
  const cycle: any = await service.retrieveRenewalCycle(ref.cycleId);
  if (
    cycle.recurring_order_id !== recurringOrder.id ||
    recurringOrder.payment_mode !== 'mercadopago_auto' ||
    (salesChannelId && recurringOrder.sales_channel_id !== salesChannelId)
  ) {
    res.sendStatus(401);
    return;
  }
  if (
    cycle.provider_payment_id === dataId &&
    ['past_due', 'order_created', 'success', 'refunded'].includes(cycle.status)
  ) {
    res.sendStatus(200);
    return;
  }

  const status = String(payment.status ?? 'unknown');
  if (!['approved', 'authorized'].includes(status)) {
    if (['rejected', 'cancelled', 'canceled'].includes(status)) {
      await recordPaymentFailure(
        req.scope,
        service,
        recurringOrder,
        cycle,
        dataId,
        String(payment.status_detail ?? status),
      );
    }
    res.sendStatus(200);
    return;
  }

  const expected = Number(cycle.expected_amount);
  const charged = Number(payment.transaction_amount);
  const currency = String(payment.currency_id ?? '').toLowerCase();
  const paymentSubscriptionId = String(
    (payment as unknown as { preapproval_id?: string; subscription_id?: string }).preapproval_id ??
      (payment as unknown as { subscription_id?: string }).subscription_id ??
      '',
  );
  if (
    !['awaiting_charge', 'past_due'].includes(cycle.status) ||
    !cycle.quote_hash ||
    !hasValidReservationState(cycle.inventory_reservation_ids) ||
    !Number.isFinite(expected) ||
    Math.abs(expected - charged) > 0.01 ||
    currency !== String(recurringOrder.currency_code ?? '').toLowerCase() ||
    (paymentSubscriptionId !== '' && paymentSubscriptionId !== recurringOrder.external_subscription_id)
  ) {
    let refunded = false;
    try {
      await new PaymentRefund(client).create({
        payment_id: dataId,
        body: {},
        requestOptions: { idempotencyKey: `subscription-mismatch-refund:${dataId}` },
      });
      refunded = true;
      const reservationIds = reservationIdsFrom(cycle.inventory_reservation_ids);
      if (reservationIds.length) {
        await deleteReservationsWorkflow(req.scope).run({ input: { ids: reservationIds } });
      }
      await service.updateRenewalCycles([{
        id: cycle.id,
        status: 'refunded',
        provider_payment_id: dataId,
        charged_amount: Number.isFinite(charged) ? charged : null,
        payment_status: 'refunded',
        paid_at: new Date(),
        refunded_at: new Date(),
        inventory_reservation_ids: { ids: [], not_required: false },
      }]);
    } catch (refundError) {
      logger.error(
        `[Subscriptions V2] reembolso de cobro no conciliado ${dataId} falló: ${(refundError as Error).message}`,
      );
    }
    await service.upsertAlert({
      dedupe_key: `payment-mismatch:${dataId}`,
      sales_channel_id: recurringOrder.sales_channel_id,
      recurring_order_id: recurringOrder.id,
      renewal_cycle_id: cycle.id,
      type: 'payment_mismatch',
      severity: 'critical',
      title: 'Cobro recurrente no conciliado',
      message: 'El estado, importe, moneda o autorización no coincide con la cotización cerrada.',
      data: {
        expected,
        charged,
        currency,
        cycle_status: cycle.status,
        payment_subscription_id: paymentSubscriptionId || null,
        expected_subscription_id: recurringOrder.external_subscription_id,
        refunded,
      },
    });
    res.sendStatus(refunded ? 200 : 500);
    return;
  }

  try {
    await withSubscriptionLock(
      req.scope,
      [`order:${recurringOrder.id}`, `renewal:${cycle.id}`],
      async () => {
      const current: any = await service.retrieveRenewalCycle(cycle.id);
      if (
        current.provider_payment_id === dataId &&
        ['order_created', 'success', 'refunded'].includes(current.status)
      ) return;

      await service.updateRenewalCycles([{
        id: cycle.id,
        status: 'paid',
        provider_payment_id: dataId,
        charged_amount: charged,
        payment_status: 'paid',
        paid_at: new Date(),
      }]);
      const { result: collection } = await createPaymentCollectionForCartWorkflow(req.scope).run({
        input: { cart_id: cycle.cart_id },
      });
      await createPaymentSessionsWorkflow(req.scope).run({
        input: {
          payment_collection_id: collection.id,
          provider_id: MERCADO_PAGO_API_PROVIDER_ID,
          data: {
            external_recurring_payment: true,
            id: dataId,
            status,
            sales_channel_id: recurringOrder.sales_channel_id,
          },
        },
      });
      const { result: completed } = await completeCartWorkflow(req.scope).run({
        input: { id: cycle.cart_id },
      });
      const orderId = (completed as { id?: string })?.id ?? null;
      if (orderId) {
        await service.markCycleSuccess(cycle.id, orderId);
        const refreshed = await service.retrieveRecurringOrder(recurringOrder.id);
        await enqueueSubscriptionCommunication(
          req.scope,
          refreshed,
          'recurring-order-generated',
          { order_display_id: (completed as { display_id?: number }).display_id ?? orderId },
          `recurring-order-generated:${cycle.id}`,
        );
      }
      const completedSubscription: any = await service.retrieveRecurringOrder(recurringOrder.id);
      await syncMercadoPagoSubscriptionStatus(req.scope, completedSubscription, 'paused');
      await service.updateRecurringOrders([{
        id: recurringOrder.id,
        financial_status: 'paused',
        cycles_completed: Number(recurringOrder.cycles_completed ?? 0) + 1,
      }]);
      await service.resolveAlert(`payment-failed:${cycle.id}`);
      },
    );
  } catch (error) {
    const current: any = await service.retrieveRenewalCycle(cycle.id);
    const attempts = Number(current.attempt_count ?? 0) + 1;
    const shouldRefund = attempts >= 3;
    let refunded = false;
    if (shouldRefund) {
      try {
        await new PaymentRefund(client).create({
          payment_id: dataId,
          body: {},
          requestOptions: { idempotencyKey: `subscription-refund:${dataId}` },
        });
        refunded = true;
        const reservationIds = reservationIdsFrom(current.inventory_reservation_ids);
        if (reservationIds.length) {
          await deleteReservationsWorkflow(req.scope).run({ input: { ids: reservationIds } });
        }
      } catch (refundError) {
        logger.error(
          `[Subscriptions V2] REEMBOLSO FALLIDO payment=${dataId}: ${(refundError as Error).message}`,
        );
      }
    }
    await service.updateRenewalCycles([{
      id: cycle.id,
      status: refunded ? 'refunded' : 'paid',
      attempt_count: attempts,
      payment_status: refunded ? 'refunded' : 'paid',
      last_error: (error as Error).message.slice(0, 1000),
      ...(refunded ? { refunded_at: new Date() } : {}),
      ...(refunded ? { inventory_reservation_ids: { ids: [], not_required: false } } : {}),
    }]);
    await service.upsertAlert({
      dedupe_key: `paid-without-order:${dataId}`,
      sales_channel_id: recurringOrder.sales_channel_id,
      recurring_order_id: recurringOrder.id,
      renewal_cycle_id: cycle.id,
      type: 'order_creation',
      severity: 'critical',
      title: refunded ? 'Pago reembolsado por pedido fallido' : 'Pago cobrado sin pedido',
      message: (error as Error).message,
      data: {
        provider_payment_id: dataId,
        cart_id: cycle.cart_id,
        order_attempt: attempts,
        refunded,
      },
    });
    logger.error(
      `[Subscriptions V2] PAGO COBRADO SIN PEDIDO payment=${dataId} cycle=${cycle.id}: ${(error as Error).message}`,
    );
    // Mientras quede dinero cobrado sin pedido devolvemos 500 para que MP
    // reintente. Tras el reembolso la incidencia queda abierta para auditar,
    // pero ya no corresponde volver a procesar el mismo pago.
    res.sendStatus(refunded ? 200 : 500);
    return;
  }
  res.sendStatus(200);
}
