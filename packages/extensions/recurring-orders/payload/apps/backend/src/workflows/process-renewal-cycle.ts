import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';
import {
  addShippingMethodToCartWorkflow,
  addToCartWorkflow,
  createReservationsWorkflow,
  createCartWorkflow,
  deleteReservationsWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
} from '@medusajs/medusa/core-flows';
import type { ICartModuleService } from '@medusajs/framework/types';
import { getKapsoSettings } from '../modules/kapso-whatsapp/settings';
import { RECURRING_ORDER_MODULE } from '../modules/recurring-order';
import type RecurringOrderModuleService from '../modules/recurring-order/service';
import { isRecurringEnabledForChannel } from '../modules/recurring-order/toggle';
import { pickDiscount, resolveProductDiscounts } from '../modules/recurring-order/offers';
import { activeRetentionPct, consumeRetention } from '../modules/recurring-order/retention';
import { resolveRuntimeConfig } from '../modules/recurring-order/runtime-config';
import {
  resolvePaymentStrategy,
  rotateMercadoPagoSubscription,
  syncMercadoPagoSubscriptionStatus,
} from '../modules/recurring-order/payment';
import { quoteSubscription } from '../modules/recurring-order/quote';
import type { SubscriptionPlanSnapshot } from '../modules/recurring-order/types';
import {
  asAddress,
  asFrequency,
  formatMoney,
  frequencyLabel,
  fullName,
} from '../modules/recurring-order/lib';

export type ProcessRenewalCycleInput = {
  cycleId: string;
  /** Ejecución manual desde el admin: ignora el vencimiento de `scheduled_at`. */
  force?: boolean;
};

const reservationIdsFrom = (value: unknown): string[] => {
  const candidate = Array.isArray(value)
    ? value
    : Array.isArray((value as { ids?: unknown[] } | null)?.ids)
      ? (value as { ids: unknown[] }).ids
      : [];
  return candidate.filter((id: unknown): id is string => typeof id === 'string');
};

const reservationNotRequiredFrom = (value: unknown): boolean =>
  (value as { not_required?: unknown } | null)?.not_required === true;

/**
 * Resultado observable de la corrida (el job y el force del admin lo loguean).
 * `pending_payment` es el final feliz del modo manual_link: el cierre real del
 * ciclo lo hace el subscriber de `order.placed` cuando el cliente paga.
 */
export type ProcessRenewalCycleResult = {
  outcome:
    | 'pending_payment'
    | 'awaiting_authorization'
    | 'awaiting_charge'
    | 'skipped'
    | 'failed_retry'
    | 'failed_terminal'
    | 'not_eligible';
  reason?: string | null;
  cycleId: string;
  confirmationUrl?: string | null;
  authorizationUrl?: string | null;
  subscriptionFailed?: boolean;
};

type AcquirePlan = {
  proceed: boolean;
  reason?: string;
  cycleId: string;
  recurringOrderId?: string;
};

/**
 * Guard de elegibilidad + transición a `processing`. Todas las entradas a este
 * workflow pasan por `runRenewalCycleLocked`; el status es el segundo guard.
 */
const acquireStep = createStep(
  'acquire-renewal-cycle',
  async (input: ProcessRenewalCycleInput, { container }) => {
    const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
    const now = new Date();

    const done = (reason: string): StepResponse<AcquirePlan> =>
      new StepResponse({ proceed: false, reason, cycleId: input.cycleId });

    let cycle: any;
    try {
      cycle = await service.retrieveRenewalCycle(input.cycleId);
    } catch {
      return done('cycle-not-found');
    }
    if (!['scheduled', 'failed', 'retrying_stock'].includes(cycle.status)) {
      return done(`status-${cycle.status}`);
    }
    if (cycle.processed_at) return done('cycle-terminal');
    if (!input.force && new Date(cycle.scheduled_at) > now) return done('not-due');

    const ro = await service.retrieveRecurringOrder(cycle.recurring_order_id);

    if (ro.status === 'cancelled' || ro.status === 'completed') {
      await service.skipCycle(cycle.id, `subscription-${ro.status}`, { scheduleNext: false }, now);
      return done(`subscription-${ro.status}`);
    }
    // Pausada: el ciclo queda agendado tal cual; al reanudar se re-agenda.
    if (ro.status !== 'active') return done(`subscription-${ro.status}`);

    // Feature apagada para el canal (demo deshabilitó el toggle): pausar la
    // suscripción para no reintentar cada 5 minutos; el ciclo queda para la reanudación.
    if (!(await isRecurringEnabledForChannel(container, ro.sales_channel_id))) {
      await service.updateRecurringOrders([
        {
          id: ro.id,
          status: 'paused',
          paused_at: now,
          metadata: { ...(ro.metadata ?? {}), paused_reason: 'feature_disabled' },
        },
      ]);
      return done('feature-disabled');
    }

    // Omitir esta entrega: consume el flag, saltea el ciclo y agenda el próximo.
    if (ro.skip_next_cycle) {
      await service.updateRecurringOrders([{ id: ro.id, skip_next_cycle: false }]);
      await service.skipCycle(cycle.id, 'skip-next-cycle', { scheduleNext: true }, now);
      return done('skip-next-cycle');
    }

    await service.updateRenewalCycles([
      {
        id: cycle.id,
        status: 'processing',
        attempt_count: (cycle.attempt_count ?? 0) + 1,
      },
    ]);
    await service.openAttempt(cycle.id, now);

    return new StepResponse({
      proceed: true,
      cycleId: cycle.id,
      recurringOrderId: ro.id,
    } as AcquirePlan);
  },
);

type ExecuteResult = ProcessRenewalCycleResult & {
  // Datos para la notificación (solo en pending_payment / failed_terminal).
  notify?: {
    email: string | null;
    phone: string | null;
    /**
     * La tienda de la suscripción. Viaja en el resultado del step porque el step que
     * notifica NO tiene la suscripción a mano — sólo este resultado.
     */
    sales_channel_id: string | null;
    customer_name: string;
    country_code: string | null;
    frequency_label: string;
    total: string | null;
    currency_code: string | null;
    item_count: number;
    expires_at: string | null;
    savings: string | null;
    price_warning?: string | null;
  };
};

/**
 * Ejecuta la renovación: valida items, arma un carrito real del canal (los
 * core-flows validan stock/precios/promos), setea envío, resuelve el cobro con
 * la estrategia del payment_mode y deja el ciclo en `pending_payment`.
 * Los errores NO propagan: acá mismo se decide reintento vs fallo terminal.
 */
const executeStep = createStep(
  'execute-renewal-cycle',
  async (plan: AcquirePlan, { container }) => {
    if (!plan.proceed) {
      return new StepResponse({
        outcome: plan.reason === 'skip-next-cycle' ? 'skipped' : 'not_eligible',
        reason: plan.reason ?? null,
        cycleId: plan.cycleId,
      } as ExecuteResult);
    }

    const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve<{
      graph: (i: unknown) => Promise<{ data: any[] }>;
    }>(ContainerRegistrationKeys.QUERY);
    const now = new Date();

    const cycle = await service.retrieveRenewalCycle(plan.cycleId);
    const ro = await service.retrieveRecurringOrder(plan.recurringOrderId as string);
    // Políticas runtime del canal (settings del admin → global → env).
    const config = await resolveRuntimeConfig(container, ro.sales_channel_id);
    const shippingAddress = asAddress(ro.shipping_address);
    const roFrequencyLabel = frequencyLabel(
      asFrequency(ro.frequency_interval),
      ro.frequency_count,
    );
    let reservationIds = reservationIdsFrom(cycle.inventory_reservation_ids);
    let reservationNotRequired = reservationNotRequiredFrom(cycle.inventory_reservation_ids);

    const fail = async (error: string): Promise<StepResponse<ExecuteResult>> => {
      logger.warn(`[RecurringOrder] ciclo ${cycle.id} falló: ${error}`);
      if (reservationIds.length) {
        try {
          await deleteReservationsWorkflow(container).run({ input: { ids: reservationIds } });
          reservationIds = [];
          await service.updateRenewalCycles([{
            id: cycle.id,
            inventory_reservation_ids: { ids: [], not_required: false },
            reserved_at: null,
          }]);
        } catch (releaseError) {
          logger.error(
            `[RecurringOrder] no se pudieron liberar reservas de ${cycle.id}: ${(releaseError as Error).message}`,
          );
        }
      }
      if (ro.plan_id && ['items_unavailable', 'all_items_unavailable'].includes(error)) {
        if (
          ro.payment_mode === 'mercadopago_auto' &&
          ro.external_subscription_id &&
          ro.financial_status !== 'paused'
        ) {
          try {
            await syncMercadoPagoSubscriptionStatus(container, ro, 'paused');
            ro.financial_status = 'paused';
          } catch (pauseError) {
            logger.error(
              `[RecurringOrder] no se pudo pausar Mercado Pago para ${ro.id}: ${(pauseError as Error).message}`,
            );
            await service.upsertAlert({
              dedupe_key: `stock-provider-pause:${cycle.id}`,
              sales_channel_id: ro.sales_channel_id,
              recurring_order_id: ro.id,
              renewal_cycle_id: cycle.id,
              type: 'payment',
              severity: 'critical',
              title: 'No se pudo pausar el cobro por falta de stock',
              message: (pauseError as Error).message,
              data: { detected_at: now.toISOString() },
            });
          }
        }
        const snapshot = ro.plan_snapshot as SubscriptionPlanSnapshot | null;
        const stockResult = await service.retryOrSkipStockCycle({
          cycle,
          error,
          retryHours: snapshot?.stock_retry_hours ?? 72,
          retryIntervalHours: snapshot?.stock_retry_interval_hours ?? 6,
          now,
        });
        let authorizationUrl: string | null = null;
        if (stockResult === 'skipped' && ro.payment_mode === 'mercadopago_auto') {
          const refreshed: any = await service.retrieveRecurringOrder(ro.id);
          const [nextCycle] = await service.listRenewalCycles(
            { recurring_order_id: ro.id, status: 'scheduled' },
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
              authorizationUrl = rotation.authorizationUrl;
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
              await service.updateRecurringOrders([{
                id: refreshed.id,
                financial_status: 'paused',
                provider_state: {
                  ...(refreshed.provider_state ?? {}),
                  status: 'paused',
                  schedule_reauthorization_required: true,
                  schedule_reauthorization_reason: 'stock-cycle-skipped',
                },
              }]);
              await service.upsertAlert({
                dedupe_key: `payment-rotation:${nextCycle.id}`,
                sales_channel_id: refreshed.sales_channel_id,
                recurring_order_id: refreshed.id,
                renewal_cycle_id: nextCycle.id,
                type: 'payment',
                severity: 'critical',
                title: 'La próxima agenda necesita reautorización',
                message: (rotationError as Error).message,
                data: { reason: 'stock-cycle-skipped', detected_at: now.toISOString() },
              });
            }
          }
        }
        return new StepResponse({
          outcome: stockResult === 'skipped' ? 'skipped' : 'failed_retry',
          reason: error,
          cycleId: cycle.id,
          authorizationUrl,
          notify: {
            email: ro.email ?? null,
            phone: ro.phone ?? null,
            sales_channel_id: ro.sales_channel_id ?? null,
            customer_name: fullName(shippingAddress.first_name, shippingAddress.last_name),
            country_code: ro.country_code ?? null,
            frequency_label: roFrequencyLabel,
            total: null,
            currency_code: ro.currency_code ?? null,
            item_count: 0,
            expires_at: null,
            savings: null,
          },
        } as ExecuteResult);
      }
      if ((cycle.attempt_count ?? 1) < config.maxAttempts) {
        await service.rescheduleFailedCycle(cycle, error, config, now);
        return new StepResponse({
          outcome: 'failed_retry',
          reason: error,
          cycleId: cycle.id,
        } as ExecuteResult);
      }
      const { subscriptionFailed } = await service.failCycleTerminal({
        cycleId: cycle.id,
        error,
        config,
        now,
      });
      return new StepResponse({
        outcome: 'failed_terminal',
        reason: error,
        cycleId: cycle.id,
        subscriptionFailed,
        notify: subscriptionFailed
          ? {
              email: ro.email ?? null,
              phone: ro.phone ?? null,
              sales_channel_id: ro.sales_channel_id ?? null,
              customer_name: fullName(shippingAddress.first_name, shippingAddress.last_name),
              country_code: ro.country_code ?? null,
              frequency_label: roFrequencyLabel,
              total: null,
              currency_code: ro.currency_code ?? null,
              item_count: 0,
              expires_at: null,
              savings: null,
            }
          : undefined,
      } as ExecuteResult);
    };

    try {
      if (
        ro.payment_mode === 'mercadopago_auto' &&
        ro.financial_status === 'paused' &&
        (ro.provider_state as { schedule_reauthorization_required?: boolean } | null)
          ?.schedule_reauthorization_required
      ) {
        try {
          const rotation = await rotateMercadoPagoSubscription(container, ro, {
            interval: ro.frequency_interval,
            count: ro.frequency_count,
            nextPaymentAt: new Date(cycle.scheduled_at),
            cycleId: cycle.id,
          });
          await service.updateRecurringOrders([{
            id: ro.id,
            external_subscription_id: rotation.externalSubscriptionId,
            financial_status: 'pending_authorization',
            provider_state: rotation.providerState,
            payment_context: {
              ...(ro.payment_context ?? {}),
              provider: 'mercado_pago',
              preapproval_id: rotation.externalSubscriptionId,
            },
          }]);
          await service.updateRenewalCycles([{
            id: cycle.id,
            status: 'awaiting_authorization',
            confirmation_url: rotation.authorizationUrl,
            payment_status: 'pending',
          }]);
          await service.closeOpenAttempt(cycle.id, 'pending_payment', null, now);
          return new StepResponse({
            outcome: 'awaiting_authorization',
            cycleId: cycle.id,
            authorizationUrl: rotation.authorizationUrl,
          } as ExecuteResult);
        } catch (rotationError) {
          await service.upsertAlert({
            dedupe_key: `payment-rotation:${cycle.id}`,
            sales_channel_id: ro.sales_channel_id,
            recurring_order_id: ro.id,
            renewal_cycle_id: cycle.id,
            type: 'payment',
            severity: 'critical',
            title: 'La agenda recurrente necesita reautorización',
            message: (rotationError as Error).message,
            data: { detected_at: now.toISOString() },
          });
          return await fail(`payment-reauthorization: ${(rotationError as Error).message}`);
        }
      }

      // Las autorizaciones automáticas permanecen pausadas entre ciclos. El
      // monto se prepara en ese estado y sólo se reactivan después de persistir
      // cotización + reserva, eliminando la ventana de cobro no conciliado.
      if (
        ro.payment_mode === 'mercadopago_auto' &&
        ro.external_subscription_id &&
        ro.financial_status === 'authorized'
      ) {
        await syncMercadoPagoSubscriptionStatus(container, ro, 'paused');
        ro.financial_status = 'paused';
      }

      const items = await service.listRecurringOrderItems({
        recurring_order_id: ro.id,
      });
      if (!items.length) return await fail('no-items');

      // Región: la guardada o re-resuelta por país (puede haber cambiado).
      let regionId: string | null = ro.region_id ?? null;
      if (!regionId) {
        const { data: regions } = await query.graph({
          entity: 'region',
          fields: ['id', 'countries.iso_2'],
        });
        const cc = (ro.country_code ?? shippingAddress.country_code ?? '').toLowerCase();
        regionId =
          regions.find((r: any) =>
            (r.countries ?? []).some((c: any) => c.iso_2?.toLowerCase() === cc),
          )?.id ?? null;
      }
      if (!regionId) return await fail('no-region-for-country');

      // Carrito de renovación: canal + cliente + direcciones + marca del ciclo.
      const { result: cart } = await createCartWorkflow(container).run({
        input: {
          region_id: regionId,
          sales_channel_id: ro.sales_channel_id,
          customer_id: ro.customer_id,
          email: ro.email ?? undefined,
          shipping_address: (ro.shipping_address ?? undefined) as
            | Record<string, unknown>
            | undefined,
          billing_address: (ro.billing_address ?? undefined) as
            | Record<string, unknown>
            | undefined,
          metadata: {
            recurring_order_id: ro.id,
            renewal_cycle_id: cycle.id,
          },
        },
      });

      // Items línea por línea: la política MVP `skip_unavailable` omite las que
      // fallan (sin stock / no vendible) y registra el detalle en el ciclo.
      const skippedItems: Array<{ variant_id: string; quantity: number; error: string }> = [];
      let added = 0;
      for (const item of items) {
        try {
          await addToCartWorkflow(container).run({
            input: {
              cart_id: cart.id,
              items: [{ variant_id: item.variant_id, quantity: item.quantity }],
            },
          });
          added++;
        } catch (e) {
          skippedItems.push({
            variant_id: item.variant_id,
            quantity: item.quantity,
            error: (e as Error).message,
          });
        }
      }
      if (added === 0) return await fail('all_items_unavailable');
      // Política de stock `fail_cycle`: cualquier línea faltante frena el ciclo
      // completo (reintenta más tarde) en vez de mandar una entrega parcial.
      if (skippedItems.length && (config.stockPolicy === 'fail_cycle' || ro.plan_id)) {
        return await fail('items_unavailable');
      }

      // Envío: la opción preferida si sigue disponible; si no, la más barata.
      const { result: options } = await listShippingOptionsForCartWithPricingWorkflow(
        container,
      ).run({ input: { cart_id: cart.id, is_return: false } });
      const priced = (options ?? []) as Array<{
        id: string;
        amount?: number | null;
        calculated_price?: { calculated_amount?: number | null } | null;
      }>;
      if (!priced.length) return await fail('no_shipping_options');
      const optionAmount = (o: (typeof priced)[number]): number =>
        Number(o.calculated_price?.calculated_amount ?? o.amount ?? Number.POSITIVE_INFINITY);
      const preferred = ro.shipping_option_id
        ? priced.find((o) => o.id === ro.shipping_option_id)
        : undefined;
      const chosen =
        preferred ?? [...priced].sort((a, b) => optionAmount(a) - optionAmount(b))[0];
      if (!chosen) return await fail('no_shipping_options');
      await addShippingMethodToCartWorkflow(container).run({
        input: { cart_id: cart.id, options: [{ id: chosen.id }] },
      });

      // Oferta de suscripción: manual line-item adjustments (% por frecuencia,
      // override por producto → setting del canal → global). Se aplican ÚLTIMO
      // (los refresh de promociones de los core-flows previos los pisarían) e
      // identificados con code 'subscription_discount' para no confundirlos
      // con promos. El link del cliente ya muestra el total con descuento.
      let savings = 0;
      let quoteSnapshot: Record<string, unknown> | null = null;
      let quoteHash: string | null = null;
      // Retención aceptada al intentar cancelar: % sobre TODA la entrega,
      // compite con la oferta normal por línea (gana la mayor, no se suman).
      const retentionPct = activeRetentionPct(ro.metadata);
      try {
        const { data: cartLines } = await query.graph({
          entity: 'cart',
          fields: [
            'id', 'items.id', 'items.product_id', 'items.variant_id',
            'items.unit_price', 'items.quantity', 'items.adjustments.amount',
          ],
          filters: { id: cart.id },
        });
        const lines = (cartLines[0]?.items ?? []) as Array<{
          id: string;
          product_id?: string | null;
          variant_id?: string | null;
          unit_price?: number | null;
          quantity: number;
          adjustments?: Array<{ amount?: number | null }>;
        }>;
        const discountsByProduct = await resolveProductDiscounts(
          container,
          ro.sales_channel_id,
          lines.map((l) => l.product_id ?? ''),
        );
        const planSnapshot = ro.plan_snapshot as SubscriptionPlanSnapshot | null;
        const v2Quote = planSnapshot
          ? quoteSubscription(
              lines.map((line) => ({
                item_id: line.id,
                product_id: line.product_id ?? '',
                variant_id: line.variant_id ?? '',
                quantity: line.quantity,
                unit_price: Number(line.unit_price ?? 0),
                existing_discount: (line.adjustments ?? []).reduce(
                  (sum, adjustment) => sum + Number(adjustment.amount ?? 0),
                  0,
                ),
              })),
              planSnapshot,
              ro.currency_code ?? planSnapshot.currency_code ?? 'ars',
            )
          : null;
        if (v2Quote) {
          quoteSnapshot = v2Quote as unknown as Record<string, unknown>;
          quoteHash = v2Quote.hash;
        }
        const adjustments = lines.flatMap((line) => {
          const quotedLine = v2Quote?.lines.find((candidate) => candidate.item_id === line.id);
          const existingDiscount = (line.adjustments ?? []).reduce(
            (sum, adjustment) => sum + Number(adjustment.amount ?? 0),
            0,
          );
          const discounts = line.product_id
            ? (discountsByProduct.get(line.product_id) ?? [])
            : [];
          const offerPct = pickDiscount(discounts, ro.frequency_interval, ro.frequency_count);
          const legacyBenefit =
            Math.round(Number(line.unit_price ?? 0) * line.quantity * Math.max(offerPct, retentionPct)) / 100;
          const retentionBenefit =
            Math.round(Number(line.unit_price ?? 0) * line.quantity * retentionPct) / 100;
          const amount = quotedLine
            ? Math.max(
                quotedLine.applied_plan_adjustment,
                Math.max(0, retentionBenefit - existingDiscount),
              )
            : Math.max(0, legacyBenefit - existingDiscount);
          if (amount <= 0) return [];
          return [
            {
              item_id: line.id,
              code: 'subscription_discount',
              amount,
              is_tax_inclusive: true,
              description: 'Beneficio por suscripcion',
            },
          ];
        });
        if (adjustments.length) {
          const cartModule = container.resolve<ICartModuleService>(Modules.CART);
          await cartModule.addLineItemAdjustments(adjustments);
          savings = adjustments.reduce((sum, a) => sum + a.amount, 0);
        }
      } catch (e) {
        // Un contrato V2 no puede cobrar precio de lista si falló su cotización.
        // El fallback best-effort queda únicamente para suscripciones legadas.
        if (ro.plan_id) throw e;
        logger.warn(
          `[RecurringOrder] descuento de suscripción falló en ciclo ${cycle.id}: ${(e as Error).message}`,
        );
      }

      // Total final del carrito (precios/promos vigentes + descuento) para la notificación.
      const { data: carts } = await query.graph({
        entity: 'cart',
        fields: ['id', 'total', 'currency_code'],
        filters: { id: cart.id },
      });
      const total = carts[0]?.total ?? null;
      const currencyCode = carts[0]?.currency_code ?? ro.currency_code ?? null;

      // Los cobros automáticos sólo quedan habilitados con una reserva física
      // válida para la canasta completa. La primera autorización puede ocurrir
      // con más anticipación; la reserva se toma durante el preflight de 24 h.
      const dueInMs = new Date(cycle.scheduled_at).getTime() - now.getTime();
      const reservationHours = Number(
        (ro.plan_snapshot as SubscriptionPlanSnapshot | null)?.reservation_hours ?? 24,
      );
      const shouldReserve =
        ro.plan_id &&
        ro.payment_mode === 'mercadopago_auto' &&
        ro.external_subscription_id &&
        ['authorized', 'paused'].includes(ro.financial_status) &&
        dueInMs <= reservationHours * 60 * 60 * 1000;
      if (shouldReserve && !reservationIds.length && !reservationNotRequired) {
        const { data: cartWithItems } = await query.graph({
          entity: 'cart',
          fields: ['id', 'items.id', 'items.variant_id', 'items.quantity'],
          filters: { id: cart.id },
        });
        const cartItems = (cartWithItems[0]?.items ?? []) as Array<{
          id: string; variant_id: string; quantity: number;
        }>;
        const { data: reservationVariants } = await query.graph({
          entity: 'variant',
          fields: [
            'id', 'manage_inventory',
            'inventory_items.inventory_item_id',
            'inventory_items.required_quantity',
          ],
          filters: { id: cartItems.map((item) => item.variant_id) },
        });
        const variantsById = new Map(reservationVariants.map((variant: any) => [variant.id, variant]));
        const pendingReservations: Array<{
          line_item_id: string;
          inventory_item_id: string;
          quantity: number;
        }> = [];
        for (const line of cartItems) {
          const variant: any = variantsById.get(line.variant_id);
          if (variant?.manage_inventory === false) continue;
          const inventoryItems = variant?.inventory_items ?? [];
          if (!inventoryItems.length) {
            logger.warn(`[RecurringOrder] variante sin vínculo de inventario: ${line.variant_id}`);
            return await fail('items_unavailable');
          }
          for (const inventoryItem of inventoryItems) {
            pendingReservations.push({
              line_item_id: line.id,
              inventory_item_id: inventoryItem.inventory_item_id,
              quantity: Number(line.quantity) * Number(inventoryItem.required_quantity ?? 1),
            });
          }
        }
        if (pendingReservations.length) {
          const locationId = (chosen as { stock_location?: { id?: string } }).stock_location?.id;
          if (!locationId) return await fail('items_unavailable');
          try {
            const { result: createdReservations } = await createReservationsWorkflow(container).run({
              input: {
                reservations: pendingReservations.map((reservation) => ({
                  ...reservation,
                  location_id: locationId,
                  allow_backorder: false,
                  description: `Suscripcion ${ro.id} ciclo ${cycle.id}`,
                  created_by: 'subscriptions-v2',
                  external_id: cycle.id,
                  metadata: { recurring_order_id: ro.id, renewal_cycle_id: cycle.id },
                })),
              },
            });
            reservationIds = createdReservations.map((reservation) => reservation.id);
          } catch (reservationError) {
            logger.warn(
              `[RecurringOrder] reserva de inventario rechazada para ${cycle.id}: ${(reservationError as Error).message}`,
            );
            return await fail('items_unavailable');
          }
        } else {
          reservationNotRequired = true;
        }
        await service.updateRenewalCycles([{
          id: cycle.id,
          status: 'inventory_reserved',
          inventory_reservation_ids: {
            ids: reservationIds,
            not_required: reservationNotRequired,
          },
          reserved_at: now,
        }]);
      }

      // Modo C del PRD (warn_over_threshold): si el total supera al de la
      // última entrega pagada en más del umbral, el aviso viaja en el email.
      // Nunca bloquea la renovación.
      let priceWarning: string | null = null;
      if (config.priceChangePolicy === 'warn_over_threshold' && total != null) {
        try {
          const [lastSuccess] = await service.listRenewalCycles(
            { recurring_order_id: ro.id, status: 'success' },
            { take: 1, order: { scheduled_at: 'DESC' } },
          );
          const lastTotal = Number(
            (lastSuccess?.metadata as { totals?: { total?: number } } | null)?.totals
              ?.total ?? 0,
          );
          if (
            lastTotal > 0 &&
            Number(total) > lastTotal * (1 + config.priceChangeThresholdPct / 100)
          ) {
            const pct = Math.round((Number(total) / lastTotal - 1) * 100);
            priceWarning = `El total de esta entrega subió ~${pct}% respecto de la anterior (${formatMoney(lastTotal)}).`;
          }
        } catch {
          // Sin última entrega comparable: no hay aviso.
        }
      }

      // Cobro según el modo (MVP: manual_link → link de confirmación).
      const strategy = resolvePaymentStrategy(ro.payment_mode ?? 'manual_link');
      const payment = await strategy.initiate(
        {
          recurringOrder: {
            id: ro.id,
            email: ro.email ?? null,
            sales_channel_id: ro.sales_channel_id ?? null,
            payment_mode: ro.payment_mode,
            payment_context: ro.payment_context ?? null,
            external_subscription_id: ro.external_subscription_id ?? null,
            provider_state: ro.provider_state ?? null,
            frequency_interval: ro.frequency_interval,
            frequency_count: ro.frequency_count,
            plan_name:
              (ro.plan_snapshot as { name?: string } | null)?.name ?? null,
            country_code: ro.country_code ?? null,
          },
          cycle: { id: cycle.id, scheduled_at: cycle.scheduled_at },
          cartId: cart.id,
        },
        container,
      );
      if (payment.kind === 'failed') return await fail(`payment: ${payment.error}`);
      if (payment.kind === 'await_authorization') {
        await service.updateRenewalCycles([{
          id: cycle.id,
          status: 'awaiting_authorization',
          cart_id: null,
          confirmation_url: payment.authorization_url,
          payment_status: 'pending',
          expected_amount: total,
          quote_snapshot: quoteSnapshot,
          quote_hash: quoteHash,
          quoted_at: now,
          last_error: null,
          metadata: {
            ...(cycle.metadata ?? {}),
            authorization_pending: true,
            totals: { total, currency_code: currencyCode },
          },
        }]);
        await service.closeOpenAttempt(cycle.id, 'pending_payment', null, now);
        return new StepResponse({
          outcome: 'awaiting_authorization', cycleId: cycle.id,
          authorizationUrl: payment.authorization_url,
        } as ExecuteResult);
      }
      if (payment.kind === 'awaiting_charge') {
        if (ro.plan_id && !reservationIds.length && !reservationNotRequired) {
          return await fail('inventory-reservation-required-before-charge');
        }
        if (ro.plan_id && (!quoteHash || total == null)) {
          return await fail('closed-quote-required-before-charge');
        }
        await service.updateRenewalCycles([{
          id: cycle.id,
          status: 'awaiting_charge',
          processed_at: null,
          cart_id: cart.id,
          confirmation_url: null,
          payment_status: 'pending',
          payment_reference: payment.external_subscription_id,
          expected_amount: total,
          quote_snapshot: quoteSnapshot,
          quote_hash: quoteHash,
          quoted_at: now,
          last_error: null,
          retry_until: new Date(new Date(cycle.scheduled_at).getTime() + 72 * 60 * 60 * 1000),
          metadata: {
            ...(cycle.metadata ?? {}), totals: { total, currency_code: currencyCode },
            ...(savings > 0 ? { applied_discount: { savings } } : {}),
          },
        }]);
        if (payment.provider_status === 'paused' || ro.financial_status === 'paused') {
          const preparedSubscription: any = await service.retrieveRecurringOrder(ro.id);
          await syncMercadoPagoSubscriptionStatus(container, preparedSubscription, 'authorized');
          ro.financial_status = 'authorized';
          await service.resolveAlert(`stock-provider-pause:${cycle.id}`);
        }
        await service.closeOpenAttempt(cycle.id, 'pending_payment', null, now);
        await service.log({
          recurring_order_id: ro.id,
          event: 'cycle_awaiting_charge',
          data: { cycle_id: cycle.id, total, currency_code: currencyCode, quote_hash: quoteHash },
        });
        return new StepResponse({
          outcome: 'awaiting_charge', cycleId: cycle.id,
          notify: {
            email: ro.email ?? null, phone: ro.phone ?? null,
            sales_channel_id: ro.sales_channel_id ?? null,
            customer_name: fullName(shippingAddress.first_name, shippingAddress.last_name),
            country_code: ro.country_code ?? null, frequency_label: roFrequencyLabel,
            total: total != null ? formatMoney(Number(total)) : null,
            currency_code: currencyCode ? String(currencyCode).toUpperCase() : null,
            item_count: added, expires_at: null,
            savings: savings > 0 ? formatMoney(savings) : null,
            price_warning: priceWarning,
          },
        } as ExecuteResult);
      }
      if (payment.kind === 'charged') {
        return await fail('unexpected-synchronous-charge');
      }

      const expiresAt = new Date(
        now.getTime() + config.paymentExpirationHours * 60 * 60 * 1000,
      );
      await service.updateRenewalCycles([
        {
          id: cycle.id,
          status: 'pending_payment',
          processed_at: now,
          cart_id: cart.id,
          confirmation_url: payment.confirmation_url,
          payment_status: 'pending',
          expires_at: expiresAt,
          last_error: null,
          metadata: {
            ...(cycle.metadata ?? {}),
            ...(skippedItems.length ? { skipped_items: skippedItems } : {}),
            ...(total != null ? { totals: { total, currency_code: currencyCode } } : {}),
            ...(savings > 0 ? { applied_discount: { savings } } : {}),
          },
        },
      ]);
      await service.closeOpenAttempt(cycle.id, 'pending_payment', null, now);
      // Consumir un ciclo de retención SOLO cuando la renovación salió (evita
      // gastar la oferta en reintentos fallidos).
      const consumedMetadata = consumeRetention(ro.metadata);
      await service.updateRecurringOrders([
        {
          id: ro.id,
          status: 'pending_payment',
          ...(consumedMetadata ? { metadata: consumedMetadata } : {}),
        },
      ]);
      await service.log({
        recurring_order_id: ro.id,
        event: 'cycle_pending_payment',
        data: {
          cycle_id: cycle.id,
          total,
          ...(savings > 0 ? { savings } : {}),
          ...(retentionPct > 0 ? { retention_pct: retentionPct } : {}),
        },
      });

      return new StepResponse({
        outcome: 'pending_payment',
        cycleId: cycle.id,
        confirmationUrl: payment.confirmation_url,
        notify: {
          email: ro.email ?? null,
          phone: ro.phone ?? null,
          sales_channel_id: ro.sales_channel_id ?? null,
          customer_name: fullName(shippingAddress.first_name, shippingAddress.last_name),
          country_code: ro.country_code ?? null,
          frequency_label: roFrequencyLabel,
          total: total != null ? formatMoney(Number(total)) : null,
          currency_code: currencyCode ? String(currencyCode).toUpperCase() : null,
          item_count: added,
          expires_at: expiresAt.toISOString(),
          savings: savings > 0 ? formatMoney(savings) : null,
          price_warning: priceWarning,
        },
      } as ExecuteResult);
    } catch (e) {
      return await fail((e as Error).message);
    }
  },
);

/**
 * Notifica el resultado: link de confirmación (email + WhatsApp si hay template
 * de Kapso configurado) o caída de la suscripción. Nunca lanza.
 */
const notifyStep = createStep(
  'dispatch-renewal-notification',
  async (result: ExecuteResult, { container }) => {
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
    const notify = result.notify;
    const wants =
      (result.outcome === 'pending_payment' && result.confirmationUrl) ||
      result.outcome === 'awaiting_charge' ||
      (result.outcome === 'failed_terminal' && result.subscriptionFailed);
    if (!wants || !notify) return new StepResponse(result);

    const notificationService = container.resolve<INotificationModuleService>(
      Modules.NOTIFICATION,
    );
    const subscriptionService = container.resolve<RecurringOrderModuleService>(
      RECURRING_ORDER_MODULE,
    );
    const notificationCycle: any = await subscriptionService.retrieveRenewalCycle(
      result.cycleId,
    );
    const notificationOrder: any = await subscriptionService.retrieveRecurringOrder(
      notificationCycle.recurring_order_id,
    );
    const isReady = result.outcome === 'pending_payment';
    const isAutomatic = result.outcome === 'awaiting_charge';
    const template = isAutomatic
      ? 'recurring-renewal-upcoming'
      : isReady
        ? 'recurring-renewal-ready'
        : 'recurring-order-failed';
    const waTemplates = getKapsoSettings().templates;
    const whatsappEnabled = isAutomatic
      ? Boolean(waTemplates.recurringRenewalUpcoming)
      : isReady
        ? Boolean(waTemplates.recurringRenewalReady)
        : Boolean(waTemplates.recurringOrderFailed);
    const data: Record<string, unknown> = {
      // La tienda del envío: el provider de email resuelve con esto la marca del mail
      // y el de Kapso el número desde el que sale. Sin él, los dos caen al global.
      sales_channel_id: notify.sales_channel_id ?? undefined,
      customer_name: notify.customer_name || undefined,
      frequency_label: notify.frequency_label,
      total: notify.total ?? undefined,
      currency_code: notify.currency_code ?? undefined,
      item_count: notify.item_count,
      confirmation_url: result.confirmationUrl ?? undefined,
      expires_at: notify.expires_at ?? undefined,
      savings: notify.savings ?? undefined,
      price_warning: notify.price_warning ?? undefined,
    };

    if (notificationOrder.plan_id) {
      if (notify.email) {
        await subscriptionService.enqueueNotification({
          dedupe_key: `${template}:email:${result.cycleId}`,
          recurring_order_id: notificationOrder.id,
          renewal_cycle_id: result.cycleId,
          sales_channel_id: notify.sales_channel_id,
          channel: 'email',
          recipient: notify.email,
          template,
          data,
        });
      }
      const whatsappConsent = Boolean(
        (notificationOrder.metadata as { whatsapp_consent?: boolean } | null)
          ?.whatsapp_consent,
      );
      if (whatsappEnabled && whatsappConsent && notify.phone) {
        await subscriptionService.enqueueNotification({
          dedupe_key: `${template}:whatsapp:${result.cycleId}`,
          recurring_order_id: notificationOrder.id,
          renewal_cycle_id: result.cycleId,
          sales_channel_id: notify.sales_channel_id,
          channel: 'whatsapp',
          recipient: notify.phone,
          template,
          data,
        });
      }
      return new StepResponse(result);
    }

    if (notify.email) {
      try {
        await notificationService.createNotifications({
          to: notify.email,
          channel: 'email',
          template,
          data,
        });
      } catch (e) {
        logger.warn(`[RecurringOrder] email ${template} falló: ${(e as Error).message}`);
      }
    }
    const whatsappConsent = Boolean(
      (notificationOrder.metadata as { whatsapp_consent?: boolean } | null)
        ?.whatsapp_consent,
    );
    if (whatsappEnabled && whatsappConsent && notify.phone) {
      try {
        await notificationService.createNotifications({
          to: notify.phone,
          channel: 'whatsapp',
          template,
          data,
        });
      } catch (e) {
        logger.warn(`[RecurringOrder] whatsapp ${template} falló: ${(e as Error).message}`);
      }
    }
    return new StepResponse(result);
  },
);

export const processRenewalCycleWorkflow = createWorkflow(
  'process-renewal-cycle',
  function (input: ProcessRenewalCycleInput) {
    const plan = acquireStep(input);
    const result = executeStep(plan);
    const final = notifyStep(result);
    return new WorkflowResponse(final);
  },
);
