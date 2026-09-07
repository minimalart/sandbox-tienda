/** Operadores soportados por una condición. */
export type ConditionOperator = 'gte' | 'lte' | 'eq' | 'neq' | 'in' | 'contains';
/** Campos evaluables (v1). */
export type ConditionField = 'orders_count' | 'total_spend' | 'spend_last_days' | 'orders_last_days' | 'days_since_last_order' | 'aov' | 'province' | 'country' | 'is_wholesale' | 'registered_no_purchase' | 'account_age_days' | 'birthday_this_month';
export type ConditionValue = string | number | boolean | Array<string | number>;
export type Condition = {
    field: ConditionField;
    operator: ConditionOperator;
    value: ConditionValue;
    /** Ventana en días para campos `*_last_days`. */
    days?: number;
};
export type RuleSet = {
    match: 'all' | 'any';
    conditions: Condition[];
};
/** Datos agregados por cliente para evaluar reglas. */
export type CustomerAggregate = {
    customer_id: string;
    has_account: boolean;
    account_age_days: number;
    orders_count: number;
    total_spend: number;
    aov: number;
    days_since_last_order: number | null;
    province: string | null;
    country: string | null;
    is_wholesale: boolean;
    /** Mes de cumpleaños (1-12) o null si no hay dato. */
    birthday_month: number | null;
    /** Órdenes (total + timestamp ms) para campos por ventana de tiempo. */
    orders: Array<{
        total: number;
        created_at: number;
    }>;
};
export declare const DYNAMIC_GROUPS_MODULE = "dynamic_groups";
