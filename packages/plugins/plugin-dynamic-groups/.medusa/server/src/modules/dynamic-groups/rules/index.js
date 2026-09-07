"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUSTOMER_AGGREGATE_FIELDS = void 0;
exports.buildCustomerAggregate = buildCustomerAggregate;
exports.evaluateCustomer = evaluateCustomer;
const DAY_MS = 86_400_000;
/** Mes de cumpleaños (1-12) desde metadata, o null. Acepta number 1-12 o fecha. */
function birthdayMonth(meta) {
    const raw = meta.birthday_month ?? meta.birthday ?? meta.date_of_birth ?? meta.dob;
    if (raw == null)
        return null;
    if (typeof raw === 'number' && raw >= 1 && raw <= 12)
        return raw;
    const s = String(raw);
    const asNum = Number(s);
    if (Number.isInteger(asNum) && asNum >= 1 && asNum <= 12)
        return asNum;
    const t = Date.parse(s);
    if (Number.isFinite(t))
        return new Date(t).getMonth() + 1;
    return null;
}
/** Una orden cuenta como compra si no está cancelada ni en borrador. */
function isPurchase(o) {
    if (o.canceled_at)
        return false;
    const s = (o.status ?? '').toLowerCase();
    return s !== 'canceled' && s !== 'draft';
}
/** Construye los agregados de un cliente desde el resultado de query.graph. */
function buildCustomerAggregate(customer, now = Date.now()) {
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
    const addr = addresses.find((a) => a.is_default_shipping) ?? addresses[0] ?? null;
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
        days_since_last_order: lastOrderAt != null ? Math.floor((now - lastOrderAt) / DAY_MS) : null,
        province: addr?.province ?? null,
        country: addr?.country_code ?? null,
        is_wholesale: wholesale === true || wholesale === 'true',
        birthday_month: birthdayMonth(meta),
        orders: purchases,
    };
}
/** Valor del campo de una condición (resuelve ventanas de tiempo). */
function fieldValue(agg, cond, now) {
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
            return (agg.birthday_month != null &&
                agg.birthday_month === new Date(now).getMonth() + 1);
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
function applyOperator(value, operator, target) {
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
            return (Array.isArray(target) &&
                target.map(String).includes(String(value ?? '')));
        case 'contains':
            return (value != null &&
                String(value).toLowerCase().includes(String(target).toLowerCase()));
        default:
            return false;
    }
}
function evalCondition(agg, cond, now) {
    return applyOperator(fieldValue(agg, cond, now), cond.operator, cond.value);
}
/** Devuelve true si el cliente cumple el ruleSet (match all=AND, any=OR). */
function evaluateCustomer(agg, ruleSet, now = Date.now()) {
    const conditions = ruleSet?.conditions ?? [];
    if (conditions.length === 0)
        return false;
    const results = conditions.map((c) => evalCondition(agg, c, now));
    return ruleSet.match === 'any'
        ? results.some(Boolean)
        : results.every(Boolean);
}
/** Campos en `query.graph` para construir el agregado. */
exports.CUSTOMER_AGGREGATE_FIELDS = [
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
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9keW5hbWljLWdyb3Vwcy9ydWxlcy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFvREEsd0RBMENDO0FBeUZELDRDQVdDO0FBMUxELE1BQU0sTUFBTSxHQUFHLFVBQVUsQ0FBQztBQXNCMUIsbUZBQW1GO0FBQ25GLFNBQVMsYUFBYSxDQUFDLElBQTZCO0lBQ2xELE1BQU0sR0FBRyxHQUNQLElBQUksQ0FBQyxjQUFjLElBQUksSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUM7SUFDekUsSUFBSSxHQUFHLElBQUksSUFBSTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQzdCLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEVBQUU7UUFBRSxPQUFPLEdBQUcsQ0FBQztJQUNqRSxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDdEIsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3hCLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxFQUFFO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDdkUsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4QixJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQUUsT0FBTyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDMUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsd0VBQXdFO0FBQ3hFLFNBQVMsVUFBVSxDQUFD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