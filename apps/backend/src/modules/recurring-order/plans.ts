import { MedusaError } from '@medusajs/framework/utils';
import type RecurringOrderModuleService from './service';
import type {
  RecurringFrequencyInterval,
  SubscriptionDiscountType,
  SubscriptionPlanSnapshot,
  SubscriptionPricePolicy,
  SubscriptionPromotionPolicy,
  SubscriptionPurchaseMode,
  SubscriptionTargetType,
} from './types';

export type PlanInput = {
  sales_channel_id: string | null;
  name: string;
  handle?: string;
  purchase_mode: SubscriptionPurchaseMode;
  price_policy: SubscriptionPricePolicy;
  promotion_policy: SubscriptionPromotionPolicy;
  allow_stacking: boolean;
  currency_code?: string | null;
  preflight_hours?: number;
  reservation_hours?: number;
  stock_retry_hours?: number;
  stock_retry_interval_hours?: number;
  payment_retry_hours?: number;
  payment_retry_interval_hours?: number;
  forecast_windows?: number[];
  trial_days?: number;
  minimum_cycles?: number;
  offers: Array<{
    label?: string | null;
    frequency_interval: RecurringFrequencyInterval;
    frequency_count: number;
    discount_type: SubscriptionDiscountType;
    discount_value: number;
    currency_code?: string | null;
    fixed_unit_prices?: Record<string, number> | null;
    sort_order?: number;
  }>;
  targets: Array<{ target_type: SubscriptionTargetType; target_id: string }>;
  metadata?: Record<string, unknown> | null;
};

export const slugifyPlanHandle = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

export function validatePlanInput(input: PlanInput): void {
  if (!input.name.trim()) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'El plan necesita un nombre.');
  if (!input.offers.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'El plan necesita al menos una frecuencia.');
  if (!input.targets.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'El plan necesita al menos un producto, variante, categoria o tag.');
  const frequencies = new Set<string>();
  for (const offer of input.offers) {
    if (!Number.isInteger(offer.frequency_count) || offer.frequency_count < 1) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'La frecuencia debe ser positiva.');
    }
    const key = `${offer.frequency_interval}:${offer.frequency_count}`;
    if (frequencies.has(key)) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'No se puede repetir una frecuencia dentro del plan.');
    frequencies.add(key);
    if (offer.discount_type === 'percentage' && (offer.discount_value < 0 || offer.discount_value > 100)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'El porcentaje debe estar entre 0 y 100.');
    }
  }
}

export async function snapshotPlan(
  service: RecurringOrderModuleService,
  planId: string,
  offerId: string,
): Promise<SubscriptionPlanSnapshot> {
  const plan: any = await service.retrieveSubscriptionPlan(planId);
  const offer: any = await service.retrieveSubscriptionPlanOffer(offerId);
  if (plan.status !== 'active' || !offer.enabled || offer.plan_id !== plan.id) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'El plan o la frecuencia ya no estan disponibles.');
  }
  return {
    id: plan.id,
    name: plan.name,
    handle: plan.handle,
    version: Number(plan.version),
    purchase_mode: plan.purchase_mode,
    price_policy: plan.price_policy,
    promotion_policy: plan.promotion_policy,
    allow_stacking: Boolean(plan.allow_stacking),
    currency_code: plan.currency_code ?? offer.currency_code ?? null,
    preflight_hours: Number(plan.preflight_hours ?? 72),
    reservation_hours: Number(plan.reservation_hours ?? 24),
    stock_retry_hours: Number(plan.stock_retry_hours ?? 72),
    stock_retry_interval_hours: Number(plan.stock_retry_interval_hours ?? 6),
    payment_retry_hours: Number(plan.payment_retry_hours ?? 72),
    payment_retry_interval_hours: Number(plan.payment_retry_interval_hours ?? 6),
    trial_days: Number(plan.trial_days ?? 0),
    minimum_cycles: Number(plan.minimum_cycles ?? 0),
    cancellation_policy: 'immediate',
    offer: {
      id: offer.id,
      label: offer.label ?? null,
      frequency_interval: offer.frequency_interval,
      frequency_count: Number(offer.frequency_count),
      discount_type: offer.discount_type,
      discount_value: Number(offer.discount_value ?? 0),
      currency_code: offer.currency_code ?? plan.currency_code ?? null,
      fixed_unit_prices: (offer.fixed_unit_prices as Record<string, number> | null) ?? null,
    },
  };
}

export async function productMatchesPlan(
  service: RecurringOrderModuleService,
  planId: string,
  product: { id: string; variant_id?: string; category_ids?: string[]; tag_values?: string[] },
): Promise<boolean> {
  const targets: any[] = await service.listSubscriptionTargets({ plan_id: planId, enabled: true });
  return targets.some((target) => {
    if (target.target_type === 'variant') return target.target_id === product.variant_id;
    if (target.target_type === 'product') return target.target_id === product.id;
    if (target.target_type === 'category') return product.category_ids?.includes(target.target_id);
    if (target.target_type === 'tag') return product.tag_values?.includes(target.target_id);
    return false;
  });
}

export async function createPlanVersion(
  service: RecurringOrderModuleService,
  input: PlanInput,
  options: { version?: number; status?: 'draft' | 'active'; legacy?: boolean } = {},
): Promise<any> {
  validatePlanInput(input);
  const handle = slugifyPlanHandle(input.handle || input.name);
  const version = options.version ?? 1;
  const [plan]: any[] = await service.createSubscriptionPlans([{
    sales_channel_id: input.sales_channel_id,
    name: input.name.trim(),
    handle,
    status: options.status ?? 'draft',
    version,
    purchase_mode: input.purchase_mode,
    price_policy: input.price_policy,
    promotion_policy: input.promotion_policy,
    allow_stacking: input.allow_stacking,
    currency_code: input.currency_code ?? null,
    preflight_hours: input.preflight_hours ?? 72,
    reservation_hours: input.reservation_hours ?? 24,
    stock_retry_hours: input.stock_retry_hours ?? 72,
    stock_retry_interval_hours: input.stock_retry_interval_hours ?? 6,
    payment_retry_hours: input.payment_retry_hours ?? 72,
    payment_retry_interval_hours: input.payment_retry_interval_hours ?? 6,
    forecast_windows: (input.forecast_windows ?? [14, 30]) as unknown as Record<string, unknown>,
    trial_days: input.trial_days ?? 0,
    minimum_cycles: input.minimum_cycles ?? 0,
    cancellation_policy: 'immediate',
    legacy: options.legacy ?? false,
    ...(options.status === 'active' ? { published_at: new Date() } : {}),
    metadata: input.metadata ?? null,
  }]);
  try {
    await service.createSubscriptionPlanOffers(
      input.offers.map((offer, index) => ({
        plan_id: plan.id,
        label: offer.label ?? null,
        frequency_interval: offer.frequency_interval,
        frequency_count: offer.frequency_count,
        discount_type: offer.discount_type,
        discount_value: offer.discount_value,
        currency_code: offer.currency_code ?? input.currency_code ?? null,
        fixed_unit_prices: offer.fixed_unit_prices ?? null,
        sort_order: offer.sort_order ?? index,
        enabled: true,
      })),
    );
    await service.createSubscriptionTargets(
      input.targets.map((target) => ({
        plan_id: plan.id,
        target_type: target.target_type,
        target_id: target.target_id,
        precedence:
          target.target_type === 'variant'
            ? 40
            : target.target_type === 'product'
              ? 30
              : target.target_type === 'category'
                ? 20
                : 10,
        enabled: true,
      })),
    );
    return plan;
  } catch (error) {
    const offers = await service.listSubscriptionPlanOffers({ plan_id: plan.id }).catch(() => []);
    const targets = await service.listSubscriptionTargets({ plan_id: plan.id }).catch(() => []);
    if (offers.length) await service.deleteSubscriptionPlanOffers(offers.map((row: any) => row.id)).catch(() => undefined);
    if (targets.length) await service.deleteSubscriptionTargets(targets.map((row: any) => row.id)).catch(() => undefined);
    await service.deleteSubscriptionPlans([plan.id]).catch(() => undefined);
    throw error;
  }
}

export async function retrievePlanBundle(
  service: RecurringOrderModuleService,
  planId: string,
): Promise<{ plan: any; offers: any[]; targets: any[] }> {
  const plan = await service.retrieveSubscriptionPlan(planId);
  const [offers, targets] = await Promise.all([
    service.listSubscriptionPlanOffers(
      { plan_id: planId },
      { order: { sort_order: 'ASC' } },
    ),
    service.listSubscriptionTargets(
      { plan_id: planId },
      { order: { precedence: 'DESC' } },
    ),
  ]);
  return { plan, offers, targets };
}
