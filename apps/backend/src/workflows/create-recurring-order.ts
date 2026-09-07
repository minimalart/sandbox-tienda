import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  QueryContext,
} from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';
import { RECURRING_ORDER_MODULE } from '../modules/recurring-order';
import type RecurringOrderModuleService from '../modules/recurring-order/service';
import { filterEligibleProducts } from '../modules/recurring-order/eligibility';
import { pickDiscount, resolveProductDiscounts } from '../modules/recurring-order/offers';
import { isRecurringEnabledForChannel } from '../modules/recurring-order/toggle';
import { isSupportedPaymentMode } from '../modules/recurring-order/payment';
import { productMatchesPlan, snapshotPlan } from '../modules/recurring-order/plans';
import { addInterval, buildManageUrl, frequencyLabel, fullName } from '../modules/recurring-order/lib';
import { enqueueSubscriptionCommunication } from '../modules/recurring-order/communications';
import type {
  RecurringAddressSnapshot,
  RecurringFrequencyInterval,
  RecurringOrderItemInput,
  SubscriptionPlanSnapshot,
} from '../modules/recurring-order/types';

export type CreateRecurringOrderInput = {
  customer_id: string;
  sales_channel_id: string;
  country_code?: string | null;
  items: RecurringOrderItemInput[];
  frequency_interval: RecurringFrequencyInterval;
  frequency_count: number;
  /** Id de una dirección guardada del customer (se copia como snapshot)… */
  address_id?: string | null;
  /** …o la dirección inline (p. ej. la shipping_address del carrito). */
  shipping_address?: RecurringAddressSnapshot | null;
  billing_address?: RecurringAddressSnapshot | null;
  /** Primera ejecución; default = now + intervalo. */
  start_at?: string | Date | null;
  payment_mode?: string;
  plan_id?: string | null;
  offer_id?: string | null;
  terms_accepted_at?: string | Date | null;
  terms_version?: string | null;
  metadata?: Record<string, unknown> | null;
};

type VariantGraph = {
  id: string;
  title?: string | null;
  sku?: string | null;
  product?: {
    id: string;
    title?: string | null;
    handle?: string | null;
    thumbnail?: string | null;
    status?: string | null;
    sales_channels?: { id: string }[];
    categories?: { id: string }[];
    tags?: { value: string }[];
  } | null;
  calculated_price?: { calculated_amount?: number | null; currency_code?: string | null } | null;
};

type PreparedPlan = {
  input: CreateRecurringOrderInput;
  email: string | null;
  phone: string | null;
  customer_name: string;
  region_id: string | null;
  currency_code: string | null;
  shipping_address: RecurringAddressSnapshot;
  items: Array<
    RecurringOrderItemInput & {
      product_id: string;
      product_snapshot: Record<string, unknown>;
      pricing_snapshot: Record<string, unknown> | null;
    }
  >;
  next_execution_at: Date;
  plan_snapshot: SubscriptionPlanSnapshot | null;
};

/**
 * Valida el alta (toggle del canal, customer, variantes publicadas del canal,
 * dirección) y captura los snapshots informativos de producto/precio.
 * Lanza MedusaError en inválidos: la ruta los traduce a 4xx.
 */
const prepareStep = createStep(
  'validate-recurring-order-input',
  async (input: CreateRecurringOrderInput, { container }) => {
    const query = container.resolve<{
      graph: (i: unknown) => Promise<{ data: any[] }>;
    }>(ContainerRegistrationKeys.QUERY);

    if (!(await isRecurringEnabledForChannel(container, input.sales_channel_id))) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Las compras recurrentes no están habilitadas para esta tienda.',
      );
    }
    const paymentMode = input.payment_mode ?? 'manual_link';
    if (!isSupportedPaymentMode(paymentMode)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Modo de pago no soportado: ${paymentMode}`,
      );
    }
    if (!input.items?.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'La suscripción necesita al menos un producto.');
    }
    if ((input.plan_id && !input.offer_id) || (!input.plan_id && input.offer_id)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'El plan y la frecuencia deben seleccionarse juntos.');
    }
    const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
    const planSnapshot = input.plan_id && input.offer_id
      ? await snapshotPlan(service, input.plan_id, input.offer_id)
      : null;
    if (planSnapshot && !input.terms_accepted_at) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Debes aceptar los terminos de la suscripcion.');
    }
    const effectiveInput: CreateRecurringOrderInput = planSnapshot
      ? {
          ...input,
          frequency_interval: planSnapshot.offer.frequency_interval,
          frequency_count: planSnapshot.offer.frequency_count,
        }
      : input;

    // Customer + dirección elegida (si va por address_id).
    const { data: customers } = await query.graph({
      entity: 'customer',
      fields: [
        'id',
        'email',
        'phone',
        'first_name',
        'last_name',
        'addresses.id',
        'addresses.first_name',
        'addresses.last_name',
        'addresses.address_1',
        'addresses.address_2',
        'addresses.company',
        'addresses.postal_code',
        'addresses.city',
        'addresses.province',
        'addresses.country_code',
        'addresses.phone',
      ],
      filters: { id: input.customer_id },
    });
    const customer = customers[0];
    if (!customer) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Cliente no encontrado.');
    }

    let shippingAddress: RecurringAddressSnapshot | null = input.shipping_address ?? null;
    if (!shippingAddress && input.address_id) {
      const addr = (customer.addresses ?? []).find(
        (a: { id: string }) => a.id === input.address_id,
      );
      if (!addr) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, 'La dirección elegida no existe.');
      }
      shippingAddress = {
        first_name: addr.first_name,
        last_name: addr.last_name,
        address_1: addr.address_1,
        address_2: addr.address_2,
        company: addr.company,
        postal_code: addr.postal_code,
        city: addr.city,
        province: addr.province,
        country_code: addr.country_code,
        phone: addr.phone,
      };
    }
    if (!shippingAddress?.address_1 || !shippingAddress?.country_code) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'La suscripción necesita una dirección de envío con calle y país.',
      );
    }

    // Región del canal por país (para el contexto de precios y el carrito de renovación).
    const countryCode = (input.country_code ?? shippingAddress.country_code ?? '').toLowerCase();
    let regionId: string | null = null;
    let currencyCode: string | null = null;
    try {
      const { data: regions } = await query.graph({
        entity: 'region',
        fields: ['id', 'currency_code', 'countries.iso_2'],
      });
      const region = regions.find((r: any) =>
        (r.countries ?? []).some((c: any) => c.iso_2?.toLowerCase() === countryCode),
      );
      regionId = region?.id ?? null;
      currencyCode = region?.currency_code ?? null;
    } catch {
      // Sin región resoluble: el alta sigue (el carrito de renovación la re-resuelve).
    }

    // Variantes: existen, pertenecen al canal y su producto está publicado.
    const variantIds = input.items.map((i) => i.variant_id);
    const { data: variants } = (await query.graph({
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
        'calculated_price.calculated_amount',
        'calculated_price.currency_code',
      ],
      filters: { id: variantIds },
      context: {
        calculated_price: QueryContext({
          ...(regionId ? { region_id: regionId } : {}),
          ...(currencyCode ? { currency_code: currencyCode } : {}),
        }),
      },
    })) as { data: VariantGraph[] };

    const byId = new Map(variants.map((v) => [v.id, v]));
    const now = new Date();
    // % de descuento vigente por producto para la frecuencia elegida (solo
    // informativo en el snapshot; el descuento real lo aplica cada renovación).
    const discountsByProduct = await resolveProductDiscounts(
      container,
      effectiveInput.sales_channel_id,
      variants.map((v) => v.product?.id ?? '').filter(Boolean),
    );
    const items: PreparedPlan['items'] = input.items.map((item) => {
      const variant = byId.get(item.variant_id);
      if (!variant?.product?.id) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `El producto de la variante ${item.variant_id} no existe.`,
        );
      }
      if (variant.product.status && variant.product.status !== 'published') {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `El producto "${variant.product.title ?? variant.id}" no está publicado.`,
        );
      }
      const channels = (variant.product as { sales_channels?: { id: string }[] }).sales_channels ?? [];
      if (channels.length && !channels.some((c) => c.id === input.sales_channel_id)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `El producto "${variant.product.title ?? variant.id}" no pertenece a esta tienda.`,
        );
      }
      const unitPrice = variant.calculated_price?.calculated_amount;
      const discountPct = pickDiscount(
        discountsByProduct.get(variant.product.id) ?? [],
        effectiveInput.frequency_interval,
        effectiveInput.frequency_count,
      );
      return {
        variant_id: item.variant_id,
        quantity: Math.max(1, Math.trunc(item.quantity) || 1),
        product_id: variant.product.id,
        product_snapshot: {
          title: variant.product.title ?? null,
          variant_title: variant.title ?? null,
          sku: variant.sku ?? null,
          handle: variant.product.handle ?? null,
          thumbnail: variant.product.thumbnail ?? null,
        },
        pricing_snapshot:
          unitPrice != null
            ? {
                unit_price: unitPrice,
                currency_code: variant.calculated_price?.currency_code ?? currencyCode,
                captured_at: now.toISOString(),
                ...(discountPct > 0 ? { discount_percentage: discountPct } : {}),
              }
            : null,
      };
    });

    // Elegibilidad por producto (scope all/selected del canal): se exige al
    // crear; las suscripciones existentes no se re-validan en cada renovación.
    const eligible = planSnapshot
      ? new Set((await Promise.all(items.map(async (item) => {
          const variant: any = byId.get(item.variant_id);
          const matches = await productMatchesPlan(service, planSnapshot.id, {
            id: item.product_id,
            variant_id: item.variant_id,
            category_ids: (variant?.product?.categories ?? []).map((c: any) => c.id),
            tag_values: (variant?.product?.tags ?? []).map((t: any) => t.value),
          });
          return matches ? item.product_id : null;
        }))).filter((id): id is string => Boolean(id)))
      : await filterEligibleProducts(
          container,
          effectiveInput.sales_channel_id,
          items.map((i) => i.product_id),
        );
    const ineligible = items.filter((i) => !eligible.has(i.product_id));
    if (ineligible.length) {
      const titles = ineligible
        .map((i) => (i.product_snapshot.title as string) ?? i.variant_id)
        .slice(0, 3)
        .join(', ');
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Estos productos no están disponibles para compra recurrente: ${titles}${ineligible.length > 3 ? '…' : ''}.`,
      );
    }

    const nextExecution = effectiveInput.start_at
      ? new Date(effectiveInput.start_at)
      : planSnapshot?.trial_days
        ? addInterval(now, 'day', planSnapshot.trial_days)
        : addInterval(now, effectiveInput.frequency_interval, effectiveInput.frequency_count);

    return new StepResponse({
      input: { ...effectiveInput, payment_mode: paymentMode },
      email: customer.email ?? null,
      phone: customer.phone ?? shippingAddress.phone ?? null,
      customer_name: fullName(customer.first_name, customer.last_name),
      region_id: regionId,
      currency_code: currencyCode,
      shipping_address: shippingAddress,
      items,
      next_execution_at: nextExecution,
      plan_snapshot: planSnapshot,
    } as PreparedPlan);
  },
);

/** Crea la suscripción + items + primer ciclo agendado. */
const createRecordStep = createStep(
  'create-recurring-order-record',
  async (plan: PreparedPlan, { container }) => {
    const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);

    const [recurringOrder] = await service.createRecurringOrders([
      {
        customer_id: plan.input.customer_id,
        email: plan.email,
        phone: plan.phone,
        sales_channel_id: plan.input.sales_channel_id,
        region_id: plan.region_id,
        country_code: plan.input.country_code ?? plan.shipping_address.country_code ?? null,
        currency_code: plan.currency_code,
        status: 'active',
        plan_id: plan.plan_snapshot?.id ?? null,
        plan_version: plan.plan_snapshot?.version ?? null,
        offer_id: plan.plan_snapshot?.offer.id ?? null,
        plan_snapshot: plan.plan_snapshot,
        payment_mode: plan.input.payment_mode ?? 'manual_link',
        payment_provider:
          plan.input.payment_mode === 'mercadopago_auto' ? 'mercado_pago' : 'manual',
        financial_status:
          plan.input.payment_mode === 'mercadopago_auto'
            ? 'pending_authorization'
            : 'manual',
        next_billing_at: plan.next_execution_at,
        terms_accepted_at: plan.input.terms_accepted_at
          ? new Date(plan.input.terms_accepted_at)
          : null,
        terms_version: plan.input.terms_version ?? null,
        frequency_interval: plan.input.frequency_interval,
        frequency_count: plan.input.frequency_count,
        next_execution_at: plan.next_execution_at,
        shipping_address: plan.shipping_address,
        billing_address: plan.input.billing_address ?? null,
        metadata: plan.input.metadata ?? null,
      },
    ]);
    if (!recurringOrder) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        'No se pudo crear la suscripción.',
      );
    }

    await service.createRecurringOrderItems(
      plan.items.map((item) => ({
        recurring_order_id: recurringOrder.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        product_snapshot: item.product_snapshot,
        pricing_snapshot: item.pricing_snapshot,
      })),
    );

    const idempotencyKey = `${recurringOrder.id}:1`;
    await service.createRenewalCycles([
      {
        recurring_order_id: recurringOrder.id,
        scheduled_at: plan.next_execution_at,
        status: 'scheduled',
        idempotency_key: idempotencyKey,
      },
    ]);
    await service.log({
      recurring_order_id: recurringOrder.id,
      event: 'created',
      actor_type: 'customer',
      actor_id: plan.input.customer_id,
      data: {
        origin: (plan.input.metadata as { origin?: string } | null)?.origin ?? null,
        items: plan.items.length,
        frequency: `${plan.input.frequency_interval}x${plan.input.frequency_count}`,
      },
    });

    return new StepResponse(
      { recurring_order_id: recurringOrder.id, plan },
      recurringOrder.id,
    );
  },
  // Compensación: si un step posterior falla, borra la suscripción creada.
  async (recurringOrderId: string | undefined, { container }) => {
    if (!recurringOrderId) return;
    const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
    await service.deleteRecurringOrders([recurringOrderId]);
  },
);

/** Notifica el alta. Nunca lanza: un SMTP caído no debe romper el alta. */
const notifyStep = createStep(
  'dispatch-recurring-created-notification',
  async (
    data: { recurring_order_id: string; plan: PreparedPlan },
    { container },
  ) => {
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
    const { plan } = data;
    if (plan.input.plan_id) {
      const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
      const recurringOrder = await service.retrieveRecurringOrder(data.recurring_order_id);
      await enqueueSubscriptionCommunication(
        container,
        recurringOrder,
        'recurring-order-created',
        {
          items: plan.items.map((item) => ({
            title: (item.product_snapshot.title as string) ?? item.variant_id,
            quantity: item.quantity,
          })),
        },
      );
      return new StepResponse({ sent: false, queued: true });
    }
    if (!plan.email) return new StepResponse({ sent: false });
    try {
      const notificationService = container.resolve<INotificationModuleService>(
        Modules.NOTIFICATION,
      );
      await notificationService.createNotifications({
        to: plan.email,
        channel: 'email',
        template: 'recurring-order-created',
        data: {
          customer_name: plan.customer_name || undefined,
          frequency_label: frequencyLabel(
            plan.input.frequency_interval,
            plan.input.frequency_count,
          ),
          // Con workflow engine en Redis los steps serializan: la Date puede llegar string.
          next_execution: new Date(plan.next_execution_at).toISOString(),
          items: plan.items.map((i) => ({
            title: (i.product_snapshot.title as string) ?? i.variant_id,
            quantity: i.quantity,
          })),
          manage_url: buildManageUrl(plan.input.country_code),
        },
      });
      return new StepResponse({ sent: true });
    } catch (e) {
      logger.warn(
        `[RecurringOrder] notificación de alta falló: ${(e as Error).message}`,
      );
      return new StepResponse({ sent: false });
    }
  },
);

export const createRecurringOrderWorkflow = createWorkflow(
  'create-recurring-order',
  function (input: CreateRecurringOrderInput) {
    const plan = prepareStep(input);
    const created = createRecordStep(plan);
    notifyStep(created);
    return new WorkflowResponse(created);
  },
);
