import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';
import { ABANDONED_CART_MODULE } from '../modules/abandoned-cart';
import type AbandonedCartModuleService from '../modules/abandoned-cart/service';
import type {
  AbandonedCartChannel,
  AbandonedCartNotificationStatus,
} from '../modules/abandoned-cart/types';
import { buildRecoveryUrl, formatMoney, fullName } from '../modules/abandoned-cart/lib';

export type NotifyAbandonedCartInput = {
  abandonedCartId: string;
  /** Fuerza un paso puntual (reenvío manual desde el admin). */
  forceStep?: number;
};

type DispatchPlan = {
  skip: boolean;
  reason?: string;
  abandonedCartId: string;
  step: number;
  email: string | null;
  phone: string | null;
  emailTemplate: string | null;
  whatsappTemplate: string | null;
  data: Record<string, unknown>;
};

type OrderRef = { id?: string | null } | null | undefined;

type CartGraph = {
  id: string;
  email?: string | null;
  sales_channel_id?: string | null;
  completed_at?: string | Date | null;
  updated_at?: string | Date | null;
  total?: number | null;
  currency_code?: string | null;
  items?: { id: string }[] | null;
  /** El link cart→order declara `hasMany` del lado de Order: puede venir array. */
  order?: OrderRef | OrderRef[];
  customer?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null;
  shipping_address?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    country_code?: string | null;
  } | null;
};

/** Normaliza `cart.order`, que según el link puede llegar como objeto o array. */
function orderIdOf(cart: CartGraph): string | null {
  const ref = Array.isArray(cart.order) ? cart.order[0] : cart.order;
  return ref?.id ?? null;
}

/**
 * Relee el carrito en vivo, decide qué paso enviar y arma el payload. Si el
 * carrito ya se completó (carrera con una orden), lo marca recuperado y salta.
 */
const prepareStep = createStep(
  'prepare-abandoned-cart-notification',
  async (input: NotifyAbandonedCartInput, { container }) => {
    const service = container.resolve<AbandonedCartModuleService>(ABANDONED_CART_MODULE);
    const query = container.resolve<{
      graph: (i: unknown) => Promise<{ data: unknown[] }>;
    }>(ContainerRegistrationKeys.QUERY);
    const config = service.getConfig();
    const now = new Date();

    const skip = (reason: string): StepResponse<DispatchPlan> =>
      new StepResponse({
        skip: true,
        reason,
        abandonedCartId: input.abandonedCartId,
        step: 0,
        email: null,
        phone: null,
        emailTemplate: null,
        whatsappTemplate: null,
        data: {},
      });

    let record: any;
    try {
      record = await service.retrieveAbandonedCart(input.abandonedCartId);
    } catch {
      return skip('tracking-not-found');
    }
    if (record.status === 'recovered' || record.status === 'cancelled') {
      return skip(`status-${record.status}`);
    }

    let cart: CartGraph | undefined;
    try {
      const { data } = (await query.graph({
        entity: 'cart',
        fields: [
          'id',
          'email',
          'completed_at',
          'updated_at',
          'total',
          'currency_code',
          // La tienda del carrito: el mail de recupero tiene que salir con SU marca —
          // es el que le pide al comprador volver a una tienda concreta.
          'sales_channel_id',
          'items.id',
          'order.id',
          'customer.first_name',
          'customer.last_name',
          'customer.phone',
          'shipping_address.first_name',
          'shipping_address.last_name',
          'shipping_address.phone',
          'shipping_address.country_code',
        ],
        filters: { id: record.cart_id },
      })) as { data: CartGraph[] };
      cart = data[0];
    } catch {
      return skip('cart-read-failed');
    }

    if (!cart) return skip('cart-missing');
    if (cart.completed_at) {
      // Se resuelve la orden por el link cart→order: pasar null acá dejaba
      // `recovered_order_id` vacío y perdía la atribución de valor recuperado.
      await service.markRecoveredByCartId(record.cart_id, orderIdOf(cart));
      return skip('cart-completed');
    }
    if (!cart.items || cart.items.length === 0) return skip('cart-empty');

    const step = input.forceStep
      ? config.steps.find((s) => s.step === input.forceStep) ?? null
      : service.resolveNextStep(record, config, now);
    if (!step) return skip('no-eligible-step');

    const email = (cart.email ?? record.email ?? null) || null;
    const phone =
      (cart.customer?.phone ??
        cart.shipping_address?.phone ??
        record.phone ??
        null) || null;

    // El tracking incluye carritos sin contacto (para medir el abandono real), y
    // el gate vive acá: sin destinatario no hay nada que enviar. Se saca de la cola
    // para no reintentar cada 15 minutos; si más adelante aparece un email o
    // teléfono, `upsertFromSnapshot` lo reprograma.
    if (!email && !phone) {
      await service.deferUntilContactable(record.id);
      return skip('no-contact');
    }
    const customerName =
      fullName(cart.customer?.first_name, cart.customer?.last_name) ||
      fullName(cart.shipping_address?.first_name, cart.shipping_address?.last_name);

    const data: Record<string, unknown> = {
      sales_channel_id: cart.sales_channel_id ?? undefined,
      cart_id: cart.id,
      customer_name: customerName || undefined,
      customer_email: email ?? undefined,
      total: formatMoney(cart.total),
      currency_code: cart.currency_code?.toUpperCase() ?? undefined,
      item_count: cart.items.length,
      recovery_url: buildRecoveryUrl(cart.id, cart.shipping_address?.country_code),
    };

    return new StepResponse({
      skip: false,
      abandonedCartId: record.id,
      step: step.step,
      email,
      phone,
      emailTemplate: step.emailTemplate,
      whatsappTemplate: step.whatsappTemplate,
      data,
    } as DispatchPlan);
  },
);

/**
 * Envía por los canales disponibles y registra el resultado (idempotente).
 * Nunca lanza por un fallo de envío: se registra `failed`/`skipped` y sigue.
 */
const dispatchStep = createStep(
  'dispatch-abandoned-cart-notification',
  async (plan: DispatchPlan, { container }) => {
    if (plan.skip) {
      return new StepResponse({
        sent: 0,
        skipped: true,
        reason: plan.reason ?? null,
        step: null as number | null,
      });
    }

    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
    const notificationService = container.resolve<INotificationModuleService>(
      Modules.NOTIFICATION,
    );
    const service = container.resolve<AbandonedCartModuleService>(ABANDONED_CART_MODULE);
    const config = service.getConfig();
    const now = new Date();

    const results: Array<{
      channel: AbandonedCartChannel;
      template: string | null;
      recipient: string | null;
      status: AbandonedCartNotificationStatus;
      error?: string | null;
    }> = [];

    if (plan.emailTemplate) {
      if (plan.email) {
        try {
          await notificationService.createNotifications({
            to: plan.email,
            channel: 'email',
            template: plan.emailTemplate,
            data: plan.data,
          });
          results.push({
            channel: 'email',
            template: plan.emailTemplate,
            recipient: plan.email,
            status: 'sent',
          });
        } catch (e) {
          const error = (e as Error).message;
          logger.warn(`[AbandonedCart] email paso ${plan.step} falló: ${error}`);
          results.push({
            channel: 'email',
            template: plan.emailTemplate,
            recipient: plan.email,
            status: 'failed',
            error,
          });
        }
      } else {
        results.push({
          channel: 'email',
          template: plan.emailTemplate,
          recipient: null,
          status: 'skipped',
          error: 'no-email',
        });
      }
    }

    if (plan.whatsappTemplate) {
      if (plan.phone) {
        try {
          await notificationService.createNotifications({
            to: plan.phone,
            channel: 'whatsapp',
            template: plan.whatsappTemplate,
            data: plan.data,
          });
          results.push({
            channel: 'whatsapp',
            template: plan.whatsappTemplate,
            recipient: plan.phone,
            status: 'sent',
          });
        } catch (e) {
          const error = (e as Error).message;
          logger.warn(`[AbandonedCart] whatsapp paso ${plan.step} falló: ${error}`);
          results.push({
            channel: 'whatsapp',
            template: plan.whatsappTemplate,
            recipient: plan.phone,
            status: 'failed',
            error,
          });
        }
      } else {
        results.push({
          channel: 'whatsapp',
          template: plan.whatsappTemplate,
          recipient: null,
          status: 'skipped',
          error: 'no-phone',
        });
      }
    }

    await service.recordStepResult({
      abandonedCartId: plan.abandonedCartId,
      step: plan.step,
      results,
      config,
      now,
    });

    const sent = results.filter((r) => r.status === 'sent').length;
    return new StepResponse({
      sent,
      skipped: false,
      reason: null as string | null,
      step: plan.step as number | null,
    });
  },
);

export const notifyAbandonedCartWorkflow = createWorkflow(
  'notify-abandoned-cart',
  function (input: NotifyAbandonedCartInput) {
    const plan = prepareStep(input);
    const result = dispatchStep(plan);
    return new WorkflowResponse(result);
  },
);
