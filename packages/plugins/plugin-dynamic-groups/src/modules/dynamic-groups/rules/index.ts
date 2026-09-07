import type {
  Condition,
  ConditionOperator,
  ConditionValue,
  CustomerAggregate,
  RuleSet,
} from '../types';

const DAY_MS = 86_400_000;

type RawOrder = {
  total?: number | string | null;
  created_at?: string | null;
  status?: string | null;
  canceled_at?: string | null;
};
type RawAddress = {
  country_code?: string | null;
  province?: string | null;
  is_default_shipping?: boolean | null;
};
type RawCustomer = {
  id: string;
  created_at?: string | null;
  has_account?: boolean | null;
  metadata?: Record<string, unknown> | null;
  orders?: RawOrder[] | null;
  addresses?: RawAddress[] | null;
};

/** Mes de cumpleaños (1-12) desde metadata, o null. Acepta number 1-12 o fecha. */
function birthdayMonth(meta: Record<string, unknown>): number | null {
  const raw =
    meta.birthday_month ?? meta.birthday ?? meta.date_of_birth ?? meta.dob;
  if (raw == null) return null;
  if (typeof raw === 'number' && raw >= 1 && raw <= 12) return raw;
  const s = String(raw);
  const asNum = Number(s);
  if (Number.isInteger(asNum) && asNum >= 1 && asNum <= 12) return asNum;
  const t = Date.parse(s);
  if (Number.isFinite(t)) return new Date(t).getMonth() + 1;
  return null;
}

/** Una orden cuenta como compra si no está cancelada ni en borrador. */
function isPurchase(o: RawOrder): boolean {
  if (o.canceled_at) return false;
  const s = (o.status ?? '').toLowerCase();
  return s !== 'canceled' && s !== 'draft';
}

/** Construye los agregados de un cliente desde el resultado de query.graph. */
export function buildCustomerAggregate(
  customer: RawCustomer,
  now: number = Date.now(),
): CustomerAggregate {
  const purchases = (customer.orders ?? [])
    .filter(isPurchase)
    .map((o) => ({
      total: Number(o.total) || 0,
      created_at: o.created_at ? Date.parse(o.created_at) : Number.NaN,
    }))
    .filter((o) => Number.isFinite(o.created_at));

  const ordersCount = purchases.length;
  const totalSpend = purchases.reduce((s, o) => s + o.total, 0);
  const lastOrderAt = purchases.length
    ? Math.max(...purchases.map((o) => o.created_at))
    : null;

  const addresses = customer.addresses ?? [];
  const addr =
    addresses.find((a) => a.is_default_shipping) ?? addresses[0] ?? null;

  const meta = customer.metadata ?? {};
  const wholesale = meta.is_wholesale;

  const createdAt = customer.created_at ? Date.parse(customer.created_at) : now;

  return {
    customer_id: customer.id,
    has_account: Boolean(customer.has_account),
    account_age_days: Math.floor((now - createdAt) / DAY_MS),
    orders_count: ordersCount,
    total_spend: totalSpend,
    aov: ordersCount > 0 ? totalSpend / ordersCount : 0,
    days_since_last_order:
      lastOrderAt != null ? Math.floor((now - lastOrderAt) / DAY_MS) : null,
    province: addr?.province ?? null,
    country: addr?.country_code ?? null,
    is_wholesale: wholesale === true || wholesale === 'true',
    birthday_month: birthdayMonth(meta),
    orders: purchases,
  };
}

/** Valor del campo de una condición (resuelve ventanas de tiempo). */
function fieldValue(
  agg: CustomerAggregate,
  cond: Condition,
  now: number,
): number | string | boolean | null {
  switch (cond.field) {
    case 'orders_count':
      return agg.orders_count;
    case 'total_spend':
      return agg.total_spend;
    case 'aov':
      return agg.aov;
    case 'days_since_last_order':
      return agg.days_since_last_order;
    case 'account_age_days':
      return agg.account_age_days;
    case 'province':
      return agg.province;
    case 'country':
      return agg.country;
    case 'is_wholesale':
      return agg.is_wholesale;
    case 'registered_no_purchase':
      return agg.has_account && agg.orders_count === 0;
    case 'birthday_this_month':
      return (
        agg.birthday_month != null &&
        agg.birthday_month === new Date(now).getMonth() + 1
      );
    case 'spend_last_days': {
      const cutoff = now - (cond.days ?? 90) * DAY_MS;
      return agg.orders
        .filter((o) => o.created_at >= cutoff)
        .reduce((s, o) => s + o.total, 0);
    }
    case 'orders_last_days': {
      const cutoff = now - (cond.days ?? 30) * DAY_MS;
      return agg.orders.filter((o) => o.created_at >= cutoff).length;
    }
    default:
      return null;
  }
}

function applyOperator(
  value: number | string | boolean | null,
  operator: ConditionOperator,
  target: ConditionValue,
): boolean {
  switch (operator) {
    case 'gte':
      return value != null && Number(value) >= Number(target);
    case 'lte':
      return value != null && Number(value) <= Number(target);
    case 'eq':
      // boolean-aware
      if (typeof value === 'boolean' || typeof target === 'boolean') {
        return Boolean(value) === (target === true || target === 'true');
      }
      return String(value) === String(target);
    case 'neq':
      return String(value) !== String(target);
    case 'in':
      return (
        Array.isArray(target) &&
        target.map(String).includes(String(value ?? ''))
      );
    case 'contains':
      return (
        value != null &&
        String(value).toLowerCase().includes(String(target).toLowerCase())
      );
    default:
      return false;
  }
}

function evalCondition(
  agg: CustomerAggregate,
  cond: Condition,
  now: number,
): boolean {
  return applyOperator(fieldValue(agg, cond, now), cond.operator, cond.value);
}

/** Devuelve true si el cliente cumple el ruleSet (match all=AND, any=OR). */
export function evaluateCustomer(
  agg: CustomerAggregate,
  ruleSet: RuleSet,
  now: number = Date.now(),
): boolean {
  const conditions = ruleSet?.conditions ?? [];
  if (conditions.length === 0) return false;
  const results = conditions.map((c) => evalCondition(agg, c, now));
  return ruleSet.match === 'any'
    ? results.some(Boolean)
    : results.every(Boolean);
}

/** Campos en `query.graph` para construir el agregado. */
export const CUSTOMER_AGGREGATE_FIELDS = [
  'id',
  'created_at',
  'has_account',
  'metadata',
  'orders.total',
  'orders.created_at',
  'orders.status',
  'orders.canceled_at',
  'addresses.country_code',
  'addresses.province',
  'addresses.is_default_shipping',
] as const;
