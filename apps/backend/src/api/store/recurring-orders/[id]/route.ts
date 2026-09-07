import { isSubscriptionFeatureEnabled } from '../../../../modules/recurring-order/settings';
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';
import { filterEligibleProducts } from '../../../../modules/recurring-order/eligibility';
import { resolveRetentionOffer } from '../../../../modules/recurring-order/retention';
import { addInterval } from '../../../../modules/recurring-order/lib';
import type { RecurringFrequencyInterval } from '../../../../modules/recurring-order/types';
import { productMatchesPlan } from '../../../../modules/recurring-order/plans';
import {
  compensateMercadoPagoSubscriptionRotation,
  rotateMercadoPagoSubscription,
  type MercadoPagoSubscriptionRotation,
} from '../../../../modules/recurring-order/payment';
import { withSubscriptionLock } from '../../../../workflows/run-renewal-cycle';
import { enqueueSubscriptionCommunication } from '../../../../modules/recurring-order/communications';
import { ownedRecurringOrder } from '../utils';

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { service, recurringOrder } = await ownedRecurringOrder(req, req.params.id as string);

  const items = await service.listRecurringOrderItems({
    recurring_order_id: recurringOrder.id,
  });
  const cycles = await service.listRenewalCycles(
    { recurring_order_id: recurringOrder.id },
    { take: 20, order: { scheduled_at: 'DESC' } }
  );
  const availableOffers = recurringOrder.plan_id
    ? await service.listSubscriptionPlanOffers(
        { plan_id: recurringOrder.plan_id, enabled: true },
        { order: { sort_order: 'ASC' } }
      )
    : [];
  // Oferta de retención del canal (el modal de cancelar decide qué ofrecer).
  const retentionOffer = isSubscriptionFeatureEnabled('SUBSCRIPTIONS_RETENTION_ENABLED')
    ? await resolveRetentionOffer(req.scope, recurringOrder.sales_channel_id)
    : null;

  res.status(200).json({
    recurring_order: {
      ...recurringOrder,
      items,
      cycles,
      retention_offer: retentionOffer,
      available_offers: availableOffers,
    },
  });
}

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

const UpdateBody = z.object({
  frequency_interval: z.enum(['day', 'week', 'month']).optional(),
  frequency_count: z.number().int().positive().max(365).optional(),
  shipping_address: AddressSchema.optional(),
  /**
   * Ediciones de items: con `id` actualiza cantidad (0 = eliminar); con
   * `variant_id` (sin id) agrega un producto nuevo a la suscripción.
   */
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        variant_id: z.string().optional(),
        quantity: z.number().int().min(0),
      })
    )
    .optional(),
});

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = UpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  await withSubscriptionLock(req.scope, `order:${req.params.id as string}`, async () => {
    const body = parsed.data;
    const { service, recurringOrder } = await ownedRecurringOrder(req, req.params.id as string);
    if (recurringOrder.status === 'cancelled' || recurringOrder.status === 'completed') {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'La suscripción ya está finalizada.');
    }
    const [inFlightCycle] = await service.listRenewalCycles(
      {
        recurring_order_id: recurringOrder.id,
        status: ['processing', 'inventory_reserved', 'awaiting_charge', 'paid', 'order_created'],
      },
      { take: 1 }
    );
    if (inFlightCycle) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Hay una entrega en proceso. Podés editar la suscripción cuando termine o cancelarla ahora.'
      );
    }

    // Preflight completo: ninguna escritura ocurre hasta saber que TODOS los
    // cambios son válidos y que la canasta final conserva al menos una línea.
    const existingBefore = await service.listRecurringOrderItems({
      recurring_order_id: recurringOrder.id,
    });
    const existingById = new Map(existingBefore.map((item: any) => [item.id, item]));
    const editIds = new Set<string>();
    if (body.items) {
      for (const edit of body.items) {
        if (edit.id) {
          if (editIds.has(edit.id)) {
            throw new MedusaError(
              MedusaError.Types.INVALID_DATA,
              'Hay un producto editado más de una vez.'
            );
          }
          editIds.add(edit.id);
          if (!existingById.has(edit.id)) {
            throw new MedusaError(
              MedusaError.Types.NOT_FOUND,
              'Uno de los productos no pertenece a esta suscripción.'
            );
          }
        } else if (!edit.variant_id || edit.quantity === 0) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            'Cada producto nuevo necesita variante y cantidad.'
          );
        }
      }
      const removals = body.items.filter((edit) => edit.id && edit.quantity === 0).length;
      const additions = body.items.filter((edit) => !edit.id && edit.quantity > 0).length;
      if (existingBefore.length - removals + additions <= 0) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          'La suscripción no puede quedar sin productos: cancelala en su lugar.'
        );
      }

      const newVariantIds = body.items
        .filter((edit) => !edit.id && edit.variant_id)
        .map((edit) => edit.variant_id as string);
      if (newVariantIds.length) {
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
          graph: (i: unknown) => Promise<{ data: any[] }>;
        };
        const { data: variants } = await query.graph({
          entity: 'variant',
          fields: [
            'id',
            'product.id',
            'product.status',
            'product.sales_channels.id',
            'product.categories.id',
            'product.tags.value',
          ],
          filters: { id: newVariantIds },
        });
        const byVariant = new Map(variants.map((variant: any) => [variant.id, variant]));
        for (const variantId of newVariantIds) {
          const variant: any = byVariant.get(variantId);
          const product = variant?.product;
          if (!product?.id || product.status !== 'published') {
            throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'El producto no está disponible.');
          }
          const channels = product.sales_channels ?? [];
          if (
            channels.length &&
            !channels.some((channel: any) => channel.id === recurringOrder.sales_channel_id)
          ) {
            throw new MedusaError(
              MedusaError.Types.NOT_ALLOWED,
              'El producto no pertenece a esta tienda.'
            );
          }
          const eligible = recurringOrder.plan_id
            ? await productMatchesPlan(service, recurringOrder.plan_id, {
                id: product.id,
                variant_id: variantId,
                category_ids: (product.categories ?? []).map((category: any) => category.id),
                tag_values: (product.tags ?? []).map((tag: any) => tag.value),
              })
            : (
                await filterEligibleProducts(req.scope, recurringOrder.sales_channel_id, [
                  product.id,
                ])
              ).has(product.id);
          if (!eligible) {
            throw new MedusaError(
              MedusaError.Types.NOT_ALLOWED,
              'El producto no está disponible para este plan de suscripción.'
            );
          }
        }
      }
    }

    const updates: Record<string, unknown> = {};
    let authorizationUrl: string | null = null;
    let frequencyCycle: any = null;
    let rotation: MercadoPagoSubscriptionRotation | null = null;
    if (body.shipping_address) updates.shipping_address = body.shipping_address;

    // Cambio de frecuencia: re-anclar la próxima ejecución a la última entrega
    // (o a hoy) y re-agendar el ciclo abierto.
    const frequencyChanged =
      (body.frequency_interval && body.frequency_interval !== recurringOrder.frequency_interval) ||
      (body.frequency_count && body.frequency_count !== recurringOrder.frequency_count);
    if (frequencyChanged) {
      const interval = (body.frequency_interval ??
        recurringOrder.frequency_interval) as RecurringFrequencyInterval;
      const count = body.frequency_count ?? recurringOrder.frequency_count;
      if (recurringOrder.plan_id) {
        const [matchingOffer] = await service.listSubscriptionPlanOffers({
          plan_id: recurringOrder.plan_id,
          frequency_interval: interval,
          frequency_count: count,
          enabled: true,
        });
        if (!matchingOffer) {
          throw new MedusaError(
            MedusaError.Types.NOT_ALLOWED,
            'La frecuencia elegida no está disponible en el plan contratado.'
          );
        }
        updates.offer_id = matchingOffer.id;
        updates.plan_snapshot = {
          ...(recurringOrder.plan_snapshot ?? {}),
          offer: {
            id: matchingOffer.id,
            label: matchingOffer.label ?? null,
            frequency_interval: matchingOffer.frequency_interval,
            frequency_count: matchingOffer.frequency_count,
            discount_type: matchingOffer.discount_type,
            discount_value: Number(matchingOffer.discount_value ?? 0),
            currency_code: matchingOffer.currency_code ?? recurringOrder.currency_code ?? null,
            fixed_unit_prices: matchingOffer.fixed_unit_prices ?? null,
          },
        };
      }
      const anchor = recurringOrder.last_execution_at
        ? new Date(recurringOrder.last_execution_at)
        : new Date();
      const now = new Date();
      let next = addInterval(anchor, interval, count);
      if (recurringOrder.payment_mode === 'mercadopago_auto') {
        const reservationHours = Number(recurringOrder.plan_snapshot?.reservation_hours ?? 24);
        const safeAuthorizationLead = new Date(
          now.getTime() + (Math.max(1, reservationHours) + 1) * 60 * 60 * 1000
        );
        if (next < safeAuthorizationLead) next = safeAuthorizationLead;
      } else if (next < now) {
        next = now;
      }

      updates.frequency_interval = interval;
      updates.frequency_count = count;
      updates.next_execution_at = next;

      const [open] = await service.listRenewalCycles(
        { recurring_order_id: recurringOrder.id, status: 'scheduled' },
        { take: 1, order: { scheduled_at: 'ASC' } }
      );
      if (!open) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          'No hay una próxima entrega abierta que se pueda reprogramar.'
        );
      }
      frequencyCycle = open;

      if (recurringOrder.payment_mode === 'mercadopago_auto') {
        rotation = await rotateMercadoPagoSubscription(req.scope, recurringOrder, {
          interval,
          count,
          nextPaymentAt: next,
          cycleId: open.id,
        });
        authorizationUrl = rotation.authorizationUrl;
        updates.external_subscription_id = rotation.externalSubscriptionId;
        updates.financial_status = 'pending_authorization';
        updates.provider_state = rotation.providerState;
        updates.payment_context = {
          ...(recurringOrder.payment_context ?? {}),
          provider: 'mercado_pago',
          preapproval_id: rotation.externalSubscriptionId,
        };
      }
    }

    try {
      if (Object.keys(updates).length) {
        await service.updateRecurringOrders([{ id: recurringOrder.id, ...updates }]);
      }
      if (frequencyCycle) {
        await service.updateRenewalCycles([
          {
            id: frequencyCycle.id,
            scheduled_at: new Date(updates.next_execution_at as Date),
            status: rotation ? 'awaiting_authorization' : frequencyCycle.status,
          },
        ]);
      }

      // Ediciones de items.
      if (body.items?.length) {
        const byId = existingById;
        for (const edit of body.items) {
          if (edit.id) {
            if (!byId.has(edit.id)) {
              throw new MedusaError(
                MedusaError.Types.NOT_FOUND,
                'Producto de suscripción no encontrado.'
              );
            }
            if (edit.quantity === 0) {
              await service.deleteRecurringOrderItems([edit.id]);
            } else {
              await service.updateRecurringOrderItems([{ id: edit.id, quantity: edit.quantity }]);
            }
          } else if (edit.variant_id && edit.quantity > 0) {
            // Alta de un producto nuevo: validación mínima (existe y está publicado).
            const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
              graph: (i: unknown) => Promise<{ data: any[] }>;
            };
            const { data: variants } = await query.graph({
              entity: 'variant',
              fields: [
                'id',
                'title',
                'sku',
                'product.id',
                'product.title',
                'product.handle',
                'product.thumbnail',
                'product.status',
                'product.sales_channels.id',
                'product.categories.id',
                'product.tags.value',
              ],
              filters: { id: edit.variant_id },
            });
            const variant = variants[0];
            if (!variant?.product?.id || variant.product.status !== 'published') {
              throw new MedusaError(
                MedusaError.Types.NOT_ALLOWED,
                'El producto no está disponible.'
              );
            }
            // Elegibilidad del canal (scope all/selected) también al agregar items.
            const eligible = recurringOrder.plan_id
              ? await productMatchesPlan(service, recurringOrder.plan_id, {
                  id: variant.product.id,
                  variant_id: variant.id,
                  category_ids: (variant.product.categories ?? []).map(
                    (category: any) => category.id
                  ),
                  tag_values: (variant.product.tags ?? []).map((tag: any) => tag.value),
                })
              : (
                  await filterEligibleProducts(req.scope, recurringOrder.sales_channel_id, [
                    variant.product.id,
                  ])
                ).has(variant.product.id);
            if (!eligible) {
              throw new MedusaError(
                MedusaError.Types.NOT_ALLOWED,
                'El producto no está disponible para compra recurrente.'
              );
            }
            await service.createRecurringOrderItems([
              {
                recurring_order_id: recurringOrder.id,
                product_id: variant.product.id,
                variant_id: variant.id,
                quantity: edit.quantity,
                product_snapshot: {
                  title: variant.product.title ?? null,
                  variant_title: variant.title ?? null,
                  sku: variant.sku ?? null,
                  handle: variant.product.handle ?? null,
                  thumbnail: variant.product.thumbnail ?? null,
                },
                pricing_snapshot: null,
              },
            ]);
          }
        }
        const remaining = await service.listRecurringOrderItems({
          recurring_order_id: recurringOrder.id,
        });
        if (!remaining.length) {
          throw new MedusaError(
            MedusaError.Types.NOT_ALLOWED,
            'La suscripción no puede quedar sin productos: cancelala en su lugar.'
          );
        }
      }
    } catch (error) {
      if (rotation) {
        try {
          await compensateMercadoPagoSubscriptionRotation(req.scope, recurringOrder, rotation);
          await service.updateRecurringOrders([
            {
              id: recurringOrder.id,
              frequency_interval: recurringOrder.frequency_interval,
              frequency_count: recurringOrder.frequency_count,
              next_execution_at: recurringOrder.next_execution_at,
              offer_id: recurringOrder.offer_id,
              plan_snapshot: recurringOrder.plan_snapshot,
              external_subscription_id: recurringOrder.external_subscription_id,
              financial_status: recurringOrder.financial_status,
              provider_state: recurringOrder.provider_state,
              payment_context: recurringOrder.payment_context,
            },
          ]);
          if (frequencyCycle) {
            await service.updateRenewalCycles([
              {
                id: frequencyCycle.id,
                scheduled_at: frequencyCycle.scheduled_at,
                status: frequencyCycle.status,
              },
            ]);
          }
        } catch {
          // La conciliación administrativa conserva evidencia de ambas referencias.
        }
      }
      throw error;
    }

    const items = await service.listRecurringOrderItems({
      recurring_order_id: recurringOrder.id,
    });
    const refreshed = await service.retrieveRecurringOrder(recurringOrder.id);
    await service.log({
      recurring_order_id: recurringOrder.id,
      event: 'updated',
      actor_type: 'customer',
      actor_id: req.auth_context.actor_id,
      data: { fields: Object.keys((req.body ?? {}) as Record<string, unknown>) },
    });
    await enqueueSubscriptionCommunication(
      req.scope,
      refreshed,
      'recurring-order-updated',
      { changed_fields: Object.keys((req.body ?? {}) as Record<string, unknown>).join(', ') },
      `recurring-order-updated:${Date.now()}`
    );
    res.status(200).json({
      recurring_order: { ...refreshed, items },
      ...(authorizationUrl ? { authorization_url: authorizationUrl } : {}),
    });
  });
}
