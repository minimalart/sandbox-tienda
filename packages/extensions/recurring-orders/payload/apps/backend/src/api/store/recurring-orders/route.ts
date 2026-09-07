import { isSubscriptionFeatureEnabled } from '../../../modules/recurring-order/settings';
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { RECURRING_ORDER_MODULE } from '../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../modules/recurring-order/service';
import { createRecurringOrderWorkflow } from '../../../workflows/create-recurring-order';
import { runRenewalCycleLocked } from '../../../workflows/run-renewal-cycle';
import {
  channelsFromPublishableKey,
  siteFromPublishableKey,
} from '../../../lib/multistore/publishable-key';

const AddressSchema = z.object({
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  address_1: z.string().min(1),
  address_2: z.string().nullish(),
  company: z.string().nullish(),
  postal_code: z.string().nullish(),
  city: z.string().nullish(),
  province: z.string().nullish(),
  country_code: z.string().min(2),
  phone: z.string().nullish(),
});

const CreateBody = z
  .object({
    items: z
      .array(
        z.object({
          variant_id: z.string().min(1),
          quantity: z.number().int().positive(),
        })
      )
      .min(1, 'La suscripción necesita al menos un producto.'),
    frequency_interval: z.enum(['day', 'week', 'month']).optional(),
    frequency_count: z.number().int().positive().max(365).optional(),
    sales_channel_id: z.string().min(1),
    country_code: z.string().min(2).nullish(),
    address_id: z.string().nullish(),
    shipping_address: AddressSchema.nullish(),
    billing_address: AddressSchema.nullish(),
    start_at: z.string().datetime().nullish(),
    payment_mode: z.enum(['manual_link', 'mercadopago_auto']).optional().default('manual_link'),
    plan_id: z.string().min(1).nullish(),
    offer_id: z.string().min(1).nullish(),
    terms_accepted: z.boolean().default(false),
    terms_version: z.string().max(40).default('2026-09-04'),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .refine((b) => b.address_id || b.shipping_address, {
    message: 'Falta la dirección de envío (address_id o shipping_address).',
  })
  .refine((b) => (b.plan_id && b.offer_id) || (b.frequency_interval && b.frequency_count), {
    message: 'Selecciona un plan y frecuencia, o indica una frecuencia manual.',
  })
  .refine((b) => !b.plan_id || b.terms_accepted, {
    message: 'Debes aceptar los terminos de la suscripcion.',
  });

/** Mis suscripciones (siempre del customer autenticado, opcionalmente por canal). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);

  const limit = req.query.limit ? Math.min(Number(req.query.limit) || 20, 100) : 20;
  const offset = req.query.offset ? Number(req.query.offset) || 0 : 0;
  const status = req.query.status as string | undefined;
  const salesChannelId = req.query.sales_channel_id as string | undefined;
  await siteFromPublishableKey(req);
  const allowedChannels = channelsFromPublishableKey(req);

  const filters: Record<string, unknown> = { customer_id: customerId };
  if (status) filters.status = status.includes(',') ? status.split(',') : status;
  if (allowedChannels.length) {
    filters.sales_channel_id =
      salesChannelId && allowedChannels.includes(salesChannelId)
        ? salesChannelId
        : salesChannelId
          ? '__not_accessible__'
          : allowedChannels;
  } else if (salesChannelId) {
    filters.sales_channel_id = salesChannelId;
  }

  const [recurring_orders, count] = await service.listAndCountRecurringOrders(filters, {
    take: limit,
    skip: offset,
    order: { created_at: 'DESC' },
    relations: ['items'],
  });

  res.status(200).json({ recurring_orders, count, limit, offset });
}

/** Alta de una suscripción desde la PDP (1 item) o el carrito (N items). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const body = parsed.data;
  const customerId = req.auth_context.actor_id;
  await siteFromPublishableKey(req);
  const allowedChannels = channelsFromPublishableKey(req);
  if (allowedChannels.length && !allowedChannels.includes(body.sales_channel_id)) {
    res.status(404).json({ message: 'El canal de venta no pertenece a esta tienda.' });
    return;
  }
  if (body.plan_id && !isSubscriptionFeatureEnabled('SUBSCRIPTIONS_V2_ENABLED')) {
    res.status(409).json({ message: 'Los planes de suscripción todavía no están habilitados.' });
    return;
  }
  if (
    body.payment_mode === 'mercadopago_auto' &&
    !isSubscriptionFeatureEnabled('SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED')
  ) {
    res.status(409).json({
      message: 'Los cobros automáticos todavía no están habilitados para esta tienda.',
    });
    return;
  }

  const { result } = await createRecurringOrderWorkflow(req.scope).run({
    input: {
      customer_id: customerId,
      sales_channel_id: body.sales_channel_id,
      country_code: body.country_code ?? null,
      items: body.items,
      frequency_interval: body.frequency_interval ?? 'month',
      frequency_count: body.frequency_count ?? 1,
      address_id: body.address_id ?? null,
      shipping_address: body.shipping_address ?? null,
      billing_address: body.billing_address ?? null,
      start_at: body.start_at ?? null,
      payment_mode: body.payment_mode,
      plan_id: body.plan_id ?? null,
      offer_id: body.offer_id ?? null,
      terms_accepted_at: body.terms_accepted ? new Date() : null,
      terms_version: body.terms_version,
      metadata: body.metadata ?? null,
    },
  });

  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const recurringOrder = await service.retrieveRecurringOrder(
    (result as { recurring_order_id: string }).recurring_order_id,
    { relations: ['items'] }
  );

  let authorization: { url: string; cycle_id: string } | null = null;
  if (body.payment_mode === 'mercadopago_auto') {
    const [firstCycle] = await service.listRenewalCycles(
      { recurring_order_id: recurringOrder.id, status: 'scheduled' },
      { take: 1, order: { scheduled_at: 'ASC' } }
    );
    if (firstCycle) {
      const renewal = await runRenewalCycleLocked(req.scope, {
        cycleId: firstCycle.id,
        force: true,
      });
      if (renewal.outcome === 'awaiting_authorization' && renewal.authorizationUrl) {
        authorization = { url: renewal.authorizationUrl, cycle_id: firstCycle.id };
      }
    }
  }

  res.status(201).json({
    recurring_order: await service.retrieveRecurringOrder(recurringOrder.id, {
      relations: ['items'],
    }),
    authorization,
  });
}
