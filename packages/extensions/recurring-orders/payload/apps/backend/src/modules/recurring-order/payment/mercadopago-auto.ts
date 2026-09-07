import { readMercadoPagoSetting } from '../../app-settings/mercadopago-runtime';
import { isSubscriptionFeatureEnabled } from '../settings';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { createHash } from 'node:crypto';
import { parseMpAccounts, resolveMpAccount } from '../../mercado-pago/utils/accounts';
import { resolveSite } from '../../../lib/multistore/resolve-site';
import { RECURRING_ORDER_MODULE } from '../types';
import type RecurringOrderModuleService from '../service';
import { buildManageUrl } from '../lib';
import type {
  ExternalSubscriptionStatus,
  RecurringPaymentProvider,
  RenewalPaymentStrategy,
} from './types';

const enabled = () => isSubscriptionFeatureEnabled('SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED');

export const mercadoPagoRecurringCapabilities = {
  authorize: true,
  updateAmount: true,
  pause: true,
  resume: true,
  cancel: true,
  changePaymentMethod: true,
  getStatus: true,
  reconcileWebhooks: true,
  // La API permite cambiar monto/moneda, pero la frecuencia y el calendario
  // de un preapproval son inmutables. Cambiarlos rota la autorización.
  updateSchedule: 'reauthorization_required',
} as const;

export async function resolveMercadoPagoSubscriptionAccount(
  container: MedusaContainer,
  salesChannelId: string | null
) {
  let siteId: string | null = null;
  let siteSlug: string | null = null;
  if (salesChannelId) {
    const resolution = await resolveSite(container, { salesChannelId });
    if (resolution.status === 'site' || resolution.status === 'singleSite') {
      siteId = resolution.site.id;
      siteSlug = resolution.site.slug;
    }
  }
  return resolveMpAccount(
    parseMpAccounts(readMercadoPagoSetting('MERCADOPAGO_ACCOUNTS')),
    {
      accessToken: readMercadoPagoSetting('MERCADOPAGO_ACCESS_TOKEN') ?? '',
      webhookSecret: readMercadoPagoSetting('MERCADOPAGO_WEBHOOK_SECRET'),
      publicKey: readMercadoPagoSetting('MERCADOPAGO_PUBLIC_KEY'),
    },
    { salesChannelId, siteId, siteSlug }
  );
}

const providerClient = (accessToken: string) =>
  new PreApproval(new MercadoPagoConfig({ accessToken }));

function recurringFrequency(
  interval: string,
  count: number
): { frequency: number; frequency_type: string } {
  if (interval === 'week') return { frequency: count * 7, frequency_type: 'days' };
  if (interval === 'day') return { frequency: count, frequency_type: 'days' };
  return { frequency: count, frequency_type: 'months' };
}

async function cartTotal(container: MedusaContainer, cartId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (input: unknown) => Promise<{ data: any[] }>;
  };
  const { data } = await query.graph({
    entity: 'cart',
    fields: ['id', 'total', 'currency_code'],
    filters: { id: cartId },
  });
  const cart = data[0];
  const amount = Number(cart?.total);
  if (!Number.isFinite(amount) || amount <= 0 || !cart?.currency_code) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'La cotizacion recurrente no tiene un total cobrable.'
    );
  }
  return { amount, currency: String(cart.currency_code).toUpperCase() };
}

export const mercadoPagoAutoStrategy: RenewalPaymentStrategy = {
  mode: 'mercadopago_auto',
  async initiate(ctx, container) {
    if (!enabled()) return { kind: 'failed', error: 'automatic-payments-disabled' };
    if (!ctx.recurringOrder.email) return { kind: 'failed', error: 'customer-email-required' };
    const account = await resolveMercadoPagoSubscriptionAccount(
      container,
      ctx.recurringOrder.sales_channel_id
    );
    if (!account.accessToken)
      return { kind: 'failed', error: 'mercadopago-account-not-configured' };
    const { amount, currency } = await cartTotal(container, ctx.cartId);
    const preapproval = providerClient(account.accessToken);
    const externalReference = `${ctx.recurringOrder.id}:${ctx.cycle.id}`;
    const idempotencyKey = `subscription:${externalReference}`;
    const existingId = ctx.recurringOrder.external_subscription_id;
    const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);

    if (!existingId) {
      const frequency = recurringFrequency(
        ctx.recurringOrder.frequency_interval,
        ctx.recurringOrder.frequency_count
      );
      const manageUrl = buildManageUrl(ctx.recurringOrder.country_code);
      if (!/^https:\/\//i.test(manageUrl)) {
        return { kind: 'failed', error: 'storefront-url-required-for-authorization' };
      }
      const backendUrl = String(
        process.env.MEDUSA_BACKEND_URL || process.env.BACKEND_URL || ''
      ).replace(/\/$/, '');
      if (!/^https:\/\//i.test(backendUrl)) {
        return { kind: 'failed', error: 'backend-url-required-for-webhooks' };
      }
      const created = await preapproval.create({
        body: {
          reason: ctx.recurringOrder.plan_name || 'Suscripcion Mercatto',
          external_reference: externalReference,
          payer_email: ctx.recurringOrder.email,
          back_url: manageUrl,
          notification_url: `${backendUrl}/webhooks/mercadopago-subscriptions?sc=${encodeURIComponent(ctx.recurringOrder.sales_channel_id ?? '')}`,
          status: 'pending',
          auto_recurring: {
            ...frequency,
            start_date: new Date(ctx.cycle.scheduled_at).toISOString(),
            transaction_amount: amount,
            currency_id: currency,
          },
        } as any,
        requestOptions: { idempotencyKey },
      });
      if (!created.id || !created.init_point)
        return { kind: 'failed', error: 'mercadopago-authorization-url-missing' };
      await service.updateRecurringOrders([
        {
          id: ctx.recurringOrder.id,
          external_subscription_id: created.id,
          financial_status: 'pending_authorization',
          provider_state: {
            status: created.status ?? 'pending',
            next_payment_date: created.next_payment_date ?? null,
            amount,
            currency,
            synced_at: new Date().toISOString(),
          },
          payment_context: { provider: 'mercado_pago', preapproval_id: created.id },
        },
      ]);
      return {
        kind: 'await_authorization',
        authorization_url: created.init_point,
        external_subscription_id: created.id,
        provider_status: created.status ?? 'pending',
      };
    }

    const current = await preapproval.get({ id: existingId });
    if (current.status === 'cancelled' || current.status === 'canceled') {
      return { kind: 'failed', error: 'mercadopago-subscription-cancelled' };
    }
    if (!['authorized', 'paused'].includes(String(current.status))) {
      if (!current.init_point)
        return { kind: 'failed', error: `mercadopago-subscription-${current.status ?? 'unknown'}` };
      return {
        kind: 'await_authorization',
        authorization_url: current.init_point,
        external_subscription_id: existingId,
        provider_status: current.status ?? 'pending',
      };
    }

    await preapproval.update({
      id: existingId,
      body: {
        external_reference: externalReference,
        auto_recurring: { transaction_amount: amount, currency_id: currency },
      },
      requestOptions: { idempotencyKey: `quote:${externalReference}` },
    });
    await service.updateRecurringOrders([
      {
        id: ctx.recurringOrder.id,
        financial_status: String(
          current.status ?? ctx.recurringOrder.provider_state?.status ?? 'paused'
        ),
        provider_state: {
          ...(ctx.recurringOrder.provider_state ?? {}),
          status: current.status ?? 'paused',
          next_payment_date: current.next_payment_date ?? null,
          amount,
          currency,
          synced_at: new Date().toISOString(),
        },
      },
    ]);
    return {
      kind: 'awaiting_charge',
      external_subscription_id: existingId,
      provider_status: String(current.status ?? 'paused'),
    };
  },
};

export const mercadoPagoRecurringProvider: RecurringPaymentProvider = {
  id: 'mercado_pago',
  capabilities: mercadoPagoRecurringCapabilities,
  strategy: mercadoPagoAutoStrategy,
};

export async function syncMercadoPagoSubscriptionStatus(
  container: MedusaContainer,
  recurringOrder: any,
  status: ExternalSubscriptionStatus
): Promise<void> {
  if (recurringOrder.payment_mode !== 'mercadopago_auto') return;
  const externalId = recurringOrder.external_subscription_id as string | null;
  if (!externalId) {
    if (status === 'cancelled' || status === 'paused') return;
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'La suscripcion todavia no fue autorizada en Mercado Pago.'
    );
  }
  const account = await resolveMercadoPagoSubscriptionAccount(
    container,
    recurringOrder.sales_channel_id ?? null
  );
  if (!account.accessToken)
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Mercado Pago no esta configurado para esta tienda.'
    );
  const targetStatus = status === 'cancelled' ? 'cancelled' : status;
  await providerClient(account.accessToken).update({
    id: externalId,
    body: { status: targetStatus },
    requestOptions: { idempotencyKey: `subscription-status:${recurringOrder.id}:${targetStatus}` },
  });
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  await service.updateRecurringOrders([
    {
      id: recurringOrder.id,
      financial_status: targetStatus,
      provider_state: {
        ...(recurringOrder.provider_state ?? {}),
        status: targetStatus,
        synced_at: new Date().toISOString(),
      },
    },
  ]);
}

export async function retrieveMercadoPagoSubscription(
  container: MedusaContainer,
  recurringOrder: any
): Promise<any> {
  const account = await resolveMercadoPagoSubscriptionAccount(
    container,
    recurringOrder.sales_channel_id ?? null
  );
  if (!account.accessToken || !recurringOrder.external_subscription_id) return null;
  return providerClient(account.accessToken).get({ id: recurringOrder.external_subscription_id });
}

export async function updateMercadoPagoSubscriptionTerms(
  container: MedusaContainer,
  recurringOrder: any,
  input: {
    cardTokenId?: string;
  }
): Promise<{ status: string | null; nextPaymentDate: unknown } | null> {
  if (recurringOrder.payment_mode !== 'mercadopago_auto') return null;
  if (!recurringOrder.external_subscription_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'La suscripción todavía no fue autorizada en Mercado Pago.'
    );
  }
  const account = await resolveMercadoPagoSubscriptionAccount(
    container,
    recurringOrder.sales_channel_id ?? null
  );
  if (!account.accessToken) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Mercado Pago no está configurado para esta tienda.'
    );
  }
  if (!input.cardTokenId) return null;
  const updated = await providerClient(account.accessToken).update({
    id: recurringOrder.external_subscription_id,
    body: { card_token_id: input.cardTokenId },
    requestOptions: {
      idempotencyKey: `subscription-card:${recurringOrder.id}:${createHash('sha256').update(input.cardTokenId).digest('hex').slice(0, 24)}`,
    },
  });
  return {
    status: updated.status ? String(updated.status) : null,
    nextPaymentDate: updated.next_payment_date ?? null,
  };
}

export type MercadoPagoSubscriptionRotation = {
  externalSubscriptionId: string;
  previousSubscriptionId: string;
  previousStatus: string;
  authorizationUrl: string;
  providerState: Record<string, unknown>;
};

function subscriptionUrls(recurringOrder: any) {
  const manageUrl = buildManageUrl(recurringOrder.country_code);
  if (!/^https:\/\//i.test(manageUrl)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'La URL pública del storefront es obligatoria para reautorizar la suscripción.'
    );
  }
  const backendUrl = String(
    process.env.MEDUSA_BACKEND_URL || process.env.BACKEND_URL || ''
  ).replace(/\/$/, '');
  if (!/^https:\/\//i.test(backendUrl)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'La URL pública del backend es obligatoria para recibir webhooks.'
    );
  }
  return { manageUrl, backendUrl };
}

/**
 * Reemplaza un preapproval cuando cambia la agenda. El anterior queda pausado
 * hasta que el webhook confirme la nueva autorización; recién entonces se
 * cancela. El caller debe persistir el resultado o ejecutar la compensación.
 */
export async function rotateMercadoPagoSubscription(
  container: MedusaContainer,
  recurringOrder: any,
  input: {
    interval: string;
    count: number;
    nextPaymentAt: Date;
    cycleId: string;
  }
): Promise<MercadoPagoSubscriptionRotation> {
  if (recurringOrder.payment_mode !== 'mercadopago_auto') {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'La suscripción no usa Mercado Pago automático.'
    );
  }
  if (!recurringOrder.external_subscription_id || !recurringOrder.email) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'La suscripción necesita una autorización y un email antes de cambiar su agenda.'
    );
  }
  const account = await resolveMercadoPagoSubscriptionAccount(
    container,
    recurringOrder.sales_channel_id ?? null
  );
  if (!account.accessToken) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Mercado Pago no está configurado para esta tienda.'
    );
  }
  const client = providerClient(account.accessToken);
  const previousSubscriptionId = String(recurringOrder.external_subscription_id);
  const current: any = await client.get({ id: previousSubscriptionId });
  const previousStatus = String(current.status ?? 'paused');
  if (['cancelled', 'canceled'].includes(previousStatus)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'La autorización de Mercado Pago está cancelada.'
    );
  }
  const amount = Number(
    current.auto_recurring?.transaction_amount ?? recurringOrder.provider_state?.amount
  );
  const currency = String(
    current.auto_recurring?.currency_id ??
      recurringOrder.provider_state?.currency ??
      recurringOrder.currency_code ??
      ''
  ).toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0 || !currency) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'No se pudo recuperar el importe autorizado para reprogramar la suscripción.'
    );
  }
  const { manageUrl, backendUrl } = subscriptionUrls(recurringOrder);
  const frequency = recurringFrequency(input.interval, input.count);
  const externalReference = `${recurringOrder.id}:${input.cycleId}`;

  if (previousStatus === 'authorized') {
    await client.update({
      id: previousSubscriptionId,
      body: { status: 'paused' },
      requestOptions: {
        idempotencyKey: `subscription-rotation-pause:${recurringOrder.id}:${input.cycleId}`,
      },
    });
  }

  try {
    const created = await client.create({
      body: {
        reason: recurringOrder.plan_name || 'Suscripcion Mercatto',
        external_reference: externalReference,
        payer_email: recurringOrder.email,
        back_url: manageUrl,
        notification_url: `${backendUrl}/webhooks/mercadopago-subscriptions?sc=${encodeURIComponent(recurringOrder.sales_channel_id ?? '')}`,
        status: 'pending',
        auto_recurring: {
          ...frequency,
          start_date: input.nextPaymentAt.toISOString(),
          transaction_amount: amount,
          currency_id: currency,
        },
      } as any,
      requestOptions: {
        idempotencyKey: `subscription-rotation:${recurringOrder.id}:${input.cycleId}:${input.interval}:${input.count}:${input.nextPaymentAt.toISOString()}`,
      },
    });
    if (!created.id || !created.init_point) {
      throw new Error('Mercado Pago no devolvió la URL de reautorización.');
    }
    return {
      externalSubscriptionId: created.id,
      previousSubscriptionId,
      previousStatus,
      authorizationUrl: created.init_point,
      providerState: {
        ...(recurringOrder.provider_state ?? {}),
        status: created.status ?? 'pending',
        amount,
        currency,
        authorization_url: created.init_point,
        previous_subscription_id: previousSubscriptionId,
        previous_subscription_status: previousStatus,
        rotation_cycle_id: input.cycleId,
        synced_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (previousStatus === 'authorized') {
      try {
        await client.update({
          id: previousSubscriptionId,
          body: { status: 'authorized' },
          requestOptions: {
            idempotencyKey: `subscription-rotation-restore:${recurringOrder.id}:${input.cycleId}`,
          },
        });
      } catch {
        // El error original se conserva; la conciliación detectará el anterior pausado.
      }
    }
    throw error;
  }
}

/** Revierte una rotación cuya persistencia local falló. */
export async function compensateMercadoPagoSubscriptionRotation(
  container: MedusaContainer,
  recurringOrder: any,
  rotation: MercadoPagoSubscriptionRotation
): Promise<void> {
  const account = await resolveMercadoPagoSubscriptionAccount(
    container,
    recurringOrder.sales_channel_id ?? null
  );
  if (!account.accessToken) return;
  const client = providerClient(account.accessToken);
  await client.update({
    id: rotation.externalSubscriptionId,
    body: { status: 'cancelled' },
    requestOptions: {
      idempotencyKey: `subscription-rotation-compensate:${rotation.externalSubscriptionId}`,
    },
  });
  if (rotation.previousStatus === 'authorized') {
    await client.update({
      id: rotation.previousSubscriptionId,
      body: { status: 'authorized' },
      requestOptions: {
        idempotencyKey: `subscription-rotation-restore:${rotation.previousSubscriptionId}`,
      },
    });
  }
}

/** Cancela por id una autorización anterior ya reemplazada. */
export async function cancelMercadoPagoSubscriptionById(
  container: MedusaContainer,
  recurringOrder: any,
  externalSubscriptionId: string
): Promise<void> {
  const account = await resolveMercadoPagoSubscriptionAccount(
    container,
    recurringOrder.sales_channel_id ?? null
  );
  if (!account.accessToken) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Mercado Pago no está configurado para esta tienda.'
    );
  }
  await providerClient(account.accessToken).update({
    id: externalSubscriptionId,
    body: { status: 'cancelled' },
    requestOptions: { idempotencyKey: `subscription-replaced-cancel:${externalSubscriptionId}` },
  });
}
