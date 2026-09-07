import type { CustomerAggregate, RuleSet } from '../types';
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
/** Construye los agregados de un cliente desde el resultado de query.graph. */
export declare function buildCustomerAggregate(customer: RawCustomer, now?: number): CustomerAggregate;
/** Devuelve true si el cliente cumple el ruleSet (match all=AND, any=OR). */
export declare function evaluateCustomer(agg: CustomerAggregate, ruleSet: RuleSet, now?: number): boolean;
/** Campos en `query.graph` para construir el agregado. */
export declare const CUSTOMER_AGGREGATE_FIELDS: readonly ["id", "created_at", "has_account", "metadata", "orders.total", "orders.created_at", "orders.status", "orders.canceled_at", "addresses.country_code", "addresses.province", "addresses.is_default_shipping"];
export {};
