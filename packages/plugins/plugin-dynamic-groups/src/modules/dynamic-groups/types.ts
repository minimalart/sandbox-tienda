/** Operadores soportados por una condición. */
export type ConditionOperator = 'gte' | 'lte' | 'eq' | 'neq' | 'in' | 'contains';

/** Campos evaluables (v1). */
export type ConditionField =
  | 'orders_count' // cantidad de órdenes (no canceladas)
  | 'total_spend' // gasto acumulado (lifetime)
  | 'spend_last_days' // gasto en los últimos `days`
  | 'orders_last_days' // órdenes en los últimos `days`
  | 'days_since_last_order' // días desde la última orden (inactividad)
  | 'aov' // ticket promedio
  | 'province' // provincia de la dirección por defecto (ej. "CABA")
  | 'country' // país (country_code)
  | 'is_wholesale' // metadata.is_wholesale === true
  | 'registered_no_purchase' // tiene cuenta pero 0 compras
  | 'account_age_days' // antigüedad de la cuenta
  | 'birthday_this_month'; // cumpleaños cae en el mes actual (metadata.birthday)

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
  days_since_last_order: number | null; // null = nunca compró
  province: string | null;
  country: string | null;
  is_wholesale: boolean;
  /** Mes de cumpleaños (1-12) o null si no hay dato. */
  birthday_month: number | null;
  /** Órdenes (total + timestamp ms) para campos por ventana de tiempo. */
  orders: Array<{ total: number; created_at: number }>;
};

export const DYNAMIC_GROUPS_MODULE = 'dynamic_groups';
