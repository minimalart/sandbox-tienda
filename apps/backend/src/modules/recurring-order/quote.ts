import crypto from 'node:crypto';
import type {
  SubscriptionDiscountType,
  SubscriptionPlanSnapshot,
} from './types';

export type SubscriptionQuoteLineInput = {
  item_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  existing_discount?: number;
};

export type SubscriptionQuoteLine = SubscriptionQuoteLineInput & {
  subtotal: number;
  plan_benefit: number;
  applied_plan_adjustment: number;
  final_total: number;
};

export type SubscriptionQuote = {
  currency_code: string;
  lines: SubscriptionQuoteLine[];
  subtotal: number;
  existing_discount: number;
  plan_benefit: number;
  applied_plan_adjustment: number;
  total: number;
  hash: string;
};

const money = (value: number) => Math.max(0, Math.round(value));

function benefitForLine(
  line: SubscriptionQuoteLineInput,
  snapshot: SubscriptionPlanSnapshot,
): number {
  const subtotal = money(line.unit_price * line.quantity);
  const offer = snapshot.offer;
  const type = offer.discount_type as SubscriptionDiscountType;
  if (snapshot.price_policy === 'fixed') {
    const fixed = offer.fixed_unit_prices?.[line.variant_id];
    if (typeof fixed === 'number' && fixed >= 0) {
      return money(Math.max(0, line.unit_price - fixed) * line.quantity);
    }
  }
  if (type === 'percentage') {
    return money((subtotal * Math.min(100, Math.max(0, offer.discount_value))) / 100);
  }
  if (type === 'fixed_amount') {
    return money(Math.min(subtotal, Math.max(0, offer.discount_value) * line.quantity));
  }
  if (type === 'fixed_price') {
    return money(
      Math.max(0, line.unit_price - Math.max(0, offer.discount_value)) * line.quantity,
    );
  }
  return 0;
}

/**
 * Cotizador puro. Los descuentos previos llegan ya calculados por Medusa.
 * En best_benefit se agrega solamente la diferencia para evitar stacking
 * accidental; en stack se suma el beneficio completo del plan.
 */
export function quoteSubscription(
  lines: SubscriptionQuoteLineInput[],
  snapshot: SubscriptionPlanSnapshot,
  currencyCode: string,
): SubscriptionQuote {
  const quoted = lines.map((line): SubscriptionQuoteLine => {
    const subtotal = money(line.unit_price * line.quantity);
    const existing = money(line.existing_discount ?? 0);
    const planBenefit = benefitForLine(line, snapshot);
    let applied = 0;
    if (snapshot.allow_stacking || snapshot.promotion_policy === 'stack') {
      applied = planBenefit;
    } else if (snapshot.promotion_policy === 'subscription_only') {
      // Las promociones core siguen en el carrito. Sumamos solo la diferencia
      // positiva; el workflow no puede incrementar el total ya promocionado.
      applied = Math.max(0, planBenefit - existing);
    } else {
      applied = Math.max(0, planBenefit - existing);
    }
    const total = money(subtotal - existing - applied);
    return {
      ...line,
      subtotal,
      existing_discount: existing,
      plan_benefit: planBenefit,
      applied_plan_adjustment: applied,
      final_total: total,
    };
  });

  const result = {
    currency_code: currencyCode.toUpperCase(),
    lines: quoted,
    subtotal: quoted.reduce((sum, line) => sum + line.subtotal, 0),
    existing_discount: quoted.reduce((sum, line) => sum + (line.existing_discount ?? 0), 0),
    plan_benefit: quoted.reduce((sum, line) => sum + line.plan_benefit, 0),
    applied_plan_adjustment: quoted.reduce(
      (sum, line) => sum + line.applied_plan_adjustment,
      0,
    ),
    total: quoted.reduce((sum, line) => sum + line.final_total, 0),
  };
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(result))
    .digest('hex');
  return { ...result, hash };
}
