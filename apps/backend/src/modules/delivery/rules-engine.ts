/**
 * Motor de reglas de despacho (M6) — funciones PURAS, sin DB ni container.
 *
 * Patrón heredado de dynamic-groups/rules/index.ts: predicados {field, op,
 * value} evaluados contra un contexto plano. Acá el "agregado" es el
 * RuleEvaluationContext derivado de la orden + zona resuelta.
 *
 * ESTRATEGIA: FIRST-MATCH (no merge).
 * --------------------------------------------------------------------------
 * Las reglas se ordenan por `priority` DESC (y `id` ASC como desempate
 * estable) y se devuelve la acción de la PRIMERA regla cuyas condiciones
 * matchean TODAS (AND). No se mergean acciones de varias reglas.
 *
 * Por qué first-match y no merge:
 *  - Predecible: el operador lee "la regla de mayor prioridad que aplica gana",
 *    sin razonar sobre overlays de surcharge/provider de reglas distintas.
 *  - Sin ambigüedad de orden: un merge tendría que definir qué pasa cuando dos
 *    reglas setean `assign_provider` distinto. First-match lo elimina.
 *  - Para combinar efectos, el operador escribe UNA regla con la condición
 *    compuesta y la acción combinada. La expresividad no se pierde, se mueve al
 *    dato (más auditable).
 *
 * Si en el futuro se necesita un recargo acumulativo, se introduce una acción
 * `surcharge_mode: 'add'` explícita — NO se cambia el default silenciosamente.
 */

import type {
  RuleAction,
  RuleEvaluationContext,
  RuleEvaluationResult,
  RuleOperator,
  RulePredicate,
  RulePredicateValue,
  MaterializedDeliveryRule,
} from './types';

type ContextScalar = string | number | boolean | null | undefined;

/** Resuelve el valor del field en el contexto. `skus`/`sku` comparten fuente. */
function resolveFieldValue(
  field: string,
  context: RuleEvaluationContext,
): ContextScalar | string[] {
  switch (field) {
    case 'weight_kg':
      return context.weight_kg ?? null;
    case 'order_total':
      return context.order_total ?? null;
    case 'item_count':
      return context.item_count ?? null;
    case 'postal_code':
      return context.postal_code ?? null;
    case 'time_of_day':
      return context.time_of_day ?? null;
    case 'zone_id':
      return context.zone_id ?? null;
    case 'pricing_tier':
      return context.pricing_tier ?? null;
    case 'temperature':
      // Requerimiento de frío de la orden (ambient|refrigerated|frozen). Se
      // compara como string con eq/neq/in/nin. Para comparaciones de severidad
      // (gt/gte/lt/lte) `compare` cae a lexicográfico, que NO refleja el orden
      // de frío; las reglas de temperatura deben usar igualdad/pertenencia.
      return context.temperature ?? null;
    case 'sku':
    case 'skus':
      // Ambos resuelven al array de SKUs de la orden: `in`/`contains` operan
      // sobre el set, `eq` matchea si la orden tiene EXACTAMENTE ese SKU.
      return context.skus ?? [];
    default:
      return null;
  }
}

function toNumber(v: unknown): number {
  return typeof v === 'number' ? v : Number(v);
}

/** Comparación numérica o lexicográfica ('HH:mm', postal codes). */
function compare(a: unknown, b: unknown): number {
  const an = toNumber(a);
  const bn = toNumber(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) {
    return an === bn ? 0 : an < bn ? -1 : 1;
  }
  const as = String(a);
  const bs = String(b);
  return as === bs ? 0 : as < bs ? -1 : 1;
}

/**
 * Evalúa UN predicado contra el contexto. Pública para testear operadores en
 * aislamiento.
 */
export function evaluatePredicate(
  predicate: RulePredicate,
  context: RuleEvaluationContext,
): boolean {
  const fieldValue = resolveFieldValue(predicate.field, context);
  const op: RuleOperator = predicate.op;
  const target: RulePredicateValue = predicate.value;

  const fieldIsArray = Array.isArray(fieldValue);

  switch (op) {
    case 'eq':
      if (fieldIsArray) {
        // Para arrays (skus), eq matchea si el set contiene EXACTAMENTE ese valor.
        return (fieldValue as string[]).map(String).includes(String(target));
      }
      if (typeof fieldValue === 'boolean' || typeof target === 'boolean') {
        return Boolean(fieldValue) === (target === true || target === 'true');
      }
      return String(fieldValue ?? '') === String(target);

    case 'neq':
      if (fieldIsArray) {
        return !(fieldValue as string[]).map(String).includes(String(target));
      }
      return String(fieldValue ?? '') !== String(target);

    case 'gt':
      return fieldValue != null && compare(fieldValue, target) > 0;
    case 'gte':
      return fieldValue != null && compare(fieldValue, target) >= 0;
    case 'lt':
      return fieldValue != null && compare(fieldValue, target) < 0;
    case 'lte':
      return fieldValue != null && compare(fieldValue, target) <= 0;

    case 'in': {
      if (!Array.isArray(target)) return false;
      const set = target.map(String);
      if (fieldIsArray) {
        // El array del field intersecta el target (ej. alguno de los SKUs).
        return (fieldValue as string[]).some((v) => set.includes(String(v)));
      }
      return set.includes(String(fieldValue ?? ''));
    }

    case 'nin': {
      if (!Array.isArray(target)) return true;
      const set = target.map(String);
      if (fieldIsArray) {
        return !(fieldValue as string[]).some((v) => set.includes(String(v)));
      }
      return !set.includes(String(fieldValue ?? ''));
    }

    case 'between': {
      if (!Array.isArray(target) || target.length !== 2) return false;
      const [min, max] = target;
      if (fieldValue == null) return false;
      return compare(fieldValue, min) >= 0 && compare(fieldValue, max) <= 0;
    }

    case 'contains': {
      if (fieldIsArray) {
        return (fieldValue as string[]).map(String).includes(String(target));
      }
      return (
        fieldValue != null &&
        String(fieldValue).toLowerCase().includes(String(target).toLowerCase())
      );
    }

    default:
      return false;
  }
}

/** Una regla matchea si TODAS sus condiciones (AND) se cumplen. */
function ruleMatches(
  rule: MaterializedDeliveryRule,
  context: RuleEvaluationContext,
): boolean {
  const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
  // Regla sin condiciones = catch-all (siempre matchea). Útil como fallback de
  // baja prioridad por zona.
  if (conditions.length === 0) return true;
  return conditions.every((c) => evaluatePredicate(c, context));
}

/**
 * Evalúa el set de reglas con estrategia FIRST-MATCH.
 *
 * Orden: solo reglas activas, por `priority` DESC, desempate por `id` ASC
 * (estable y determinístico). Devuelve la acción de la primera que matchea, o
 * una acción vacía con `matched_rule_id: null` si ninguna aplica.
 */
export function evaluateRules(
  context: RuleEvaluationContext,
  rules: MaterializedDeliveryRule[],
): RuleEvaluationResult {
  const active = rules
    .filter((r) => r.active)
    .sort((a, b) => {
      const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
      if (byPriority !== 0) return byPriority;
      return String(a.id).localeCompare(String(b.id));
    });

  for (const rule of active) {
    if (ruleMatches(rule, context)) {
      return {
        matched_rule_id: rule.id,
        action: (rule.action ?? {}) as RuleAction,
      };
    }
  }

  return { matched_rule_id: null, action: {} };
}
