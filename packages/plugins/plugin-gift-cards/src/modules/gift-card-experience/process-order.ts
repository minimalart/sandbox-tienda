import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  claimGiftCardWorkflow,
  createGiftCardsWorkflow,
  type CreateGiftCardsWorkflowInput,
} from '@medusajs/loyalty-plugin/workflows';
import {
  assertGiftCardBuyerIsNotRecipient,
  normalizeGiftCardConfig,
} from '../../lib/gift-cards-shared';
import { siteIdOfChannel } from '../../lib/multistore/resolve-site';
import { GIFT_CARD_EXPERIENCE_MODULE } from '.';
import type GiftCardExperienceModuleService from './service';
import { resolveScheduledAt } from './schedule';
import { getGiftCardExperienceSettings } from './settings';
import type { GiftCardDeliveryRow } from './types';

type OrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  total?: number;
  metadata?: Record<string, unknown> | null;
  product?: { is_giftcard?: boolean } | null;
};

type Order = {
  id: string;
  display_id?: number | null;
  email: string;
  customer_id?: string | null;
  /** La tienda que vendió. Es lo que elige QUÉ configuración se sella en la entrega. */
  sales_channel_id?: string | null;
  currency_code: string;
  total: number;
  canceled_at?: string | Date | null;
  status?: string;
  items?: OrderItem[];
  payment_collections?: Array<{
    payments?: Array<{
      amount?: number;
      captured_at?: string | Date | null;
      canceled_at?: string | Date | null;
    }> | null;
  }> | null;
};

/**
 * AND entre el interruptor de DESPLIEGUE (`app-settings`, DB > env) y el de
 * NEGOCIO (`gift_card_settings.enabled`). Hacen falta los dos.
 */
export function isGiftCardExperienceEnabled(settingsEnabled: boolean): boolean {
  return getGiftCardExperienceSettings().experienceEnabled && settingsEnabled;
}

async function retrieveOrder(container: MedusaContainer, orderId: string): Promise<Order | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph(input: unknown): Promise<{ data: unknown[] }>;
  };
  const { data } = await query.graph({
    entity: 'order',
    fields: [
      'id', 'display_id', 'email', 'customer_id', 'currency_code', 'total', 'status', 'canceled_at',
      'sales_channel_id',
      'items.id', 'items.quantity', 'items.unit_price', 'items.total', 'items.metadata',
      'items.product.is_giftcard',
      'payment_collections.payments.amount', 'payment_collections.payments.captured_at',
      'payment_collections.payments.canceled_at',
    ],
    filters: { id: orderId },
  });
  return (data[0] as Order | undefined) ?? null;
}

export function capturedAmount(order: Order): number {
  return (order.payment_collections ?? []).flatMap((collection) => collection.payments ?? [])
    .filter((payment) => Boolean(payment.captured_at) && !payment.canceled_at)
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
}

export function isFullyPaidOrder(order: Order): boolean {
  if (order.canceled_at || order.status === 'canceled') return false;
  return capturedAmount(order) >= Number(order.total ?? 0);
}

export function isUniqueConstraintError(error: unknown): boolean {
  const value = error as { code?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } };
  const code = String(value?.code ?? value?.cause?.code ?? '');
  const message = String(value?.message ?? value?.cause?.message ?? '').toLowerCase();
  return code === '23505' || message.includes('unique constraint') || message.includes('duplicate key');
}

/**
 * Crea los intents de UNA orden con la configuración de LA TIENDA QUE VENDIÓ.
 *
 * Todo lo que se lee acá se SELLA en `gift_card_delivery` —`expires_at` sale de
 * `default_expiry_days`, más `timezone`, `scheduled_at` y el diseño por defecto— y no
 * se vuelve a mirar: si sale de la fila global, la entrega queda mal para siempre
 * aunque después alguien arregle la configuración de la tienda. Por eso la tienda se
 * resuelve acá y no en el envío, que ya es tarde.
 *
 * `settings.enabled` también pasa a ser por tienda, y eso NO deja nada colgado: los
 * intents se crean de cero en cada pasada, así que una tienda con la experiencia
 * apagada simplemente no crea ninguno. Es distinto del gate de los JOBS, que corre
 * DESPUÉS de reclamar filas y por eso sigue siendo de lote (ver `delivery.ts`).
 */
export async function createGiftCardIntentsForOrder(
  container: MedusaContainer,
  order: Order,
): Promise<GiftCardDeliveryRow[]> {
  const service = container.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const settings = await service.getSettings(await siteIdOfChannel(container, order.sales_channel_id));
  if (!isGiftCardExperienceEnabled(settings.enabled)) return [];
  const defaultDesign = await service.ensureDefaultDesign();
  const intents: GiftCardDeliveryRow[] = [];

  for (const item of (order.items ?? []).filter((candidate) => candidate.product?.is_giftcard === true)) {
    const config = normalizeGiftCardConfig(item.metadata ?? {}, settings.default_design_id);
    assertGiftCardBuyerIsNotRecipient(config, order.email);
    const design = await service.resolveDesign(config.design_id, true) ?? defaultDesign;
    const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1));
    const faceValue = Number(item.unit_price) || 0;
    const paidPerUnit = Number(item.total ?? faceValue * quantity) / quantity;
    const scheduledAt = resolveScheduledAt(config.delivery, settings);
    const expiresAt = settings.default_expiry_days
      ? new Date(Date.now() + settings.default_expiry_days * 86_400_000)
      : null;

    for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
      const result = await service.createDeliveryIntent({
        idempotency_key: `gift-card:${order.id}:${item.id}:${unitIndex}`,
        order_id: order.id,
        order_display_id: order.display_id ?? null,
        line_item_id: item.id,
        unit_index: unitIndex,
        buyer_customer_id: order.customer_id ?? null,
        buyer_email: order.email,
        config,
        design,
        currency_code: order.currency_code,
        face_value: faceValue,
        paid_amount: paidPerUnit,
        timezone: settings.timezone,
        scheduled_at: scheduledAt,
        expires_at: expiresAt,
      });
      intents.push(result.delivery);
    }
  }
  return intents;
}

async function issueIntent(
  container: MedusaContainer,
  service: GiftCardExperienceModuleService,
  delivery: GiftCardDeliveryRow,
): Promise<void> {
  const claimed = await service.claimIssuance(delivery.id, new Date());
  if (!claimed) return;
  try {
    let giftCard = await service.findOfficialGiftCardByIdempotencyKey(claimed.idempotency_key);
    if (!giftCard) {
      for (let collisionAttempt = 0; collisionAttempt < 3 && !giftCard; collisionAttempt += 1) {
        const workflowInput = [{
          value: Number(claimed.face_value),
          currency_code: claimed.currency_code,
          expires_at: claimed.expires_at ? new Date(claimed.expires_at).toISOString() : null,
          reference: 'order',
          reference_id: claimed.order_id,
          line_item_id: claimed.line_item_id,
          customer_id: null,
          metadata: {
            idempotency_key: claimed.idempotency_key,
            gift_card_delivery_id: claimed.id,
            unit_index: claimed.unit_index,
          },
        }];
        try {
          // The plugin runtime explicitly generates a crypto code when omitted,
          // although its published 2.17.2 TypeScript DTO still marks `code` required.
          const { result } = await createGiftCardsWorkflow(container).run({
            input: workflowInput as unknown as CreateGiftCardsWorkflowInput,
          });
          const created = result[0];
          if (!created) throw new Error('El workflow oficial no devolvió la gift card emitida.');
          giftCard = { id: created.id, code: created.code };
        } catch (error) {
          // Rebuild the input on each attempt so the plugin generates a fresh
          // cryptographic code. All other failures are non-retryable here.
          if (!isUniqueConstraintError(error) || collisionAttempt === 2) throw error;
        }
      }
    }

    if (!giftCard) throw new Error('No se pudo emitir una gift card única.');

    const selfClaim = claimed.delivery_mode === 'self' && claimed.buyer_customer_id;
    if (selfClaim) {
      await claimGiftCardWorkflow(container).run({
        input: { code: giftCard.code, customer_id: claimed.buyer_customer_id! },
      });
    }
    const account = await resolveBackingAccount(container, giftCard.id);
    await service.markIssued(claimed.id, {
      giftCardId: giftCard.id,
      storeCreditAccountId: account?.id ?? null,
      deliveryStatus: selfClaim ? 'sent' : claimed.scheduled_at ? 'scheduled' : 'pending',
      claimedCustomerId: selfClaim ? claimed.buyer_customer_id : null,
    });
  } catch (error) {
    await service.markIssuanceFailed(claimed.id, error);
    throw error;
  }
}

export async function resolveBackingAccount(
  container: MedusaContainer,
  giftCardId: string,
): Promise<{ id: string; code?: string } | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph(input: unknown): Promise<{ data: unknown[] }>;
  };
  const { data } = await query.graph({
    entity: 'gift_card',
    fields: ['id', 'store_credit_accounts.id', 'store_credit_accounts.code'],
    filters: { id: giftCardId },
  });
  const row = data[0] as { store_credit_accounts?: Array<{ id: string; code?: string }> } | undefined;
  return row?.store_credit_accounts?.[0] ?? null;
}

export async function processGiftCardsForOrder(
  container: MedusaContainer,
  orderId: string,
): Promise<{ paid: boolean; intentCount: number }> {
  const order = await retrieveOrder(container, orderId);
  if (!order) return { paid: false, intentCount: 0 };
  const service = container.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  if (order.canceled_at || order.status === 'canceled') {
    const canceled = await service.cancelUnissuedDeliveriesForOrder(order.id);
    return { paid: false, intentCount: canceled };
  }
  const intents = await createGiftCardIntentsForOrder(container, order);
  if (!isFullyPaidOrder(order)) return { paid: false, intentCount: intents.length };
  for (const intent of intents) await issueIntent(container, service, intent);
  return { paid: true, intentCount: intents.length };
}
