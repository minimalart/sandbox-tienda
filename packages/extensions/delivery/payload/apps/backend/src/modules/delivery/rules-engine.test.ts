import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePredicate, evaluateRules } from './rules-engine.ts';
import type {
  MaterializedDeliveryRule,
  RuleEvaluationContext,
  RulePredicate,
} from './types.ts';

/** Contexto base reutilizable; cada test sobreescribe lo que necesita. */
const ctx = (overrides: Partial<RuleEvaluationContext> = {}): RuleEvaluationContext => ({
  weight_kg: 10,
  order_total: 5000,
  item_count: 3,
  skus: ['SKU-A', 'SKU-B'],
  postal_code: '1414',
  time_of_day: '14:30',
  zone_id: 'zone_1',
  pricing_tier: 'standard',
  ...overrides,
});

const pred = (field: string, op: RulePredicate['op'], value: RulePredicate['value']): RulePredicate => ({
  field,
  op,
  value,
});

const rule = (r: Partial<MaterializedDeliveryRule>): MaterializedDeliveryRule => ({
  id: 'rule_x',
  name: 'rule',
  delivery_zone_id: null,
  priority: 0,
  conditions: [],
  action: {},
  active: true,
  ...r,
});

describe('evaluatePredicate — operadores', () => {
  describe('eq', () => {
    it('true cuando el valor escalar coincide (string-aware)', () => {
      assert.equal(evaluatePredicate(pred('order_total', 'eq', 5000), ctx()), true);
      assert.equal(evaluatePredicate(pred('postal_code', 'eq', '1414'), ctx()), true);
    });
    it('false cuando el valor escalar no coincide', () => {
      assert.equal(evaluatePredicate(pred('order_total', 'eq', 9999), ctx()), false);
    });
    it('sobre array (skus) matchea si el set contiene exactamente ese valor', () => {
      assert.equal(evaluatePredicate(pred('skus', 'eq', 'SKU-A'), ctx()), true);
      assert.equal(evaluatePredicate(pred('skus', 'eq', 'SKU-Z'), ctx()), false);
    });
  });

  describe('neq', () => {
    it('true cuando difiere, false cuando coincide', () => {
      assert.equal(evaluatePredicate(pred('zone_id', 'neq', 'zone_2'), ctx()), true);
      assert.equal(evaluatePredicate(pred('zone_id', 'neq', 'zone_1'), ctx()), false);
    });
    it('sobre array: true si el set NO contiene el valor', () => {
      assert.equal(evaluatePredicate(pred('skus', 'neq', 'SKU-Z'), ctx()), true);
      assert.equal(evaluatePredicate(pred('skus', 'neq', 'SKU-A'), ctx()), false);
    });
  });

  describe('gt / gte', () => {
    it('gt: estrictamente mayor', () => {
      assert.equal(evaluatePredicate(pred('weight_kg', 'gt', 5), ctx()), true);
      assert.equal(evaluatePredicate(pred('weight_kg', 'gt', 10), ctx()), false);
      assert.equal(evaluatePredicate(pred('weight_kg', 'gt', 20), ctx()), false);
    });
    it('gte: mayor o igual', () => {
      assert.equal(evaluatePredicate(pred('weight_kg', 'gte', 10), ctx()), true);
      assert.equal(evaluatePredicate(pred('weight_kg', 'gte', 11), ctx()), false);
    });
    it('false si el field es null', () => {
      assert.equal(evaluatePredicate(pred('weight_kg', 'gt', 1), ctx({ weight_kg: null })), false);
      assert.equal(evaluatePredicate(pred('weight_kg', 'gte', 1), ctx({ weight_kg: null })), false);
    });
  });

  describe('lt / lte', () => {
    it('lt: estrictamente menor', () => {
      assert.equal(evaluatePredicate(pred('weight_kg', 'lt', 20), ctx()), true);
      assert.equal(evaluatePredicate(pred('weight_kg', 'lt', 10), ctx()), false);
    });
    it('lte: menor o igual', () => {
      assert.equal(evaluatePredicate(pred('weight_kg', 'lte', 10), ctx()), true);
      assert.equal(evaluatePredicate(pred('weight_kg', 'lte', 9), ctx()), false);
    });
    it('false si el field es null', () => {
      assert.equal(evaluatePredicate(pred('weight_kg', 'lt', 100), ctx({ weight_kg: null })), false);
    });
  });

  describe('in / nin sobre escalar', () => {
    it('in: true si el escalar pertenece al array target', () => {
      assert.equal(evaluatePredicate(pred('pricing_tier', 'in', ['premium', 'standard']), ctx()), true);
      assert.equal(evaluatePredicate(pred('pricing_tier', 'in', ['premium', 'vip']), ctx()), false);
    });
    it('in: false si target no es array', () => {
      assert.equal(evaluatePredicate(pred('pricing_tier', 'in', 'standard'), ctx()), false);
    });
    it('nin: true si el escalar NO pertenece, false si pertenece', () => {
      assert.equal(evaluatePredicate(pred('pricing_tier', 'nin', ['premium', 'vip']), ctx()), true);
      assert.equal(evaluatePredicate(pred('pricing_tier', 'nin', ['standard']), ctx()), false);
    });
    it('nin: true si target no es array (nada que excluir)', () => {
      assert.equal(evaluatePredicate(pred('pricing_tier', 'nin', 'standard'), ctx()), true);
    });
  });

  describe('in / nin sobre array (skus)', () => {
    it('in: true si hay intersección entre skus y el target', () => {
      assert.equal(evaluatePredicate(pred('skus', 'in', ['SKU-B', 'SKU-Z']), ctx()), true);
      assert.equal(evaluatePredicate(pred('skus', 'in', ['SKU-X', 'SKU-Z']), ctx()), false);
    });
    it('nin: true si NO hay intersección, false si la hay', () => {
      assert.equal(evaluatePredicate(pred('skus', 'nin', ['SKU-X', 'SKU-Z']), ctx()), true);
      assert.equal(evaluatePredicate(pred('skus', 'nin', ['SKU-A']), ctx()), false);
    });
  });

  describe('between', () => {
    it('numérico: inclusivo en ambos extremos', () => {
      assert.equal(evaluatePredicate(pred('weight_kg', 'between', [5, 15]), ctx()), true);
      assert.equal(evaluatePredicate(pred('weight_kg', 'between', [10, 10]), ctx()), true);
      assert.equal(evaluatePredicate(pred('weight_kg', 'between', [0, 9]), ctx()), false);
      assert.equal(evaluatePredicate(pred('weight_kg', 'between', [11, 20]), ctx()), false);
    });
    it("'HH:mm' lexicográfico: dentro de la ventana", () => {
      assert.equal(evaluatePredicate(pred('time_of_day', 'between', ['09:00', '18:00']), ctx({ time_of_day: '14:30' })), true);
      assert.equal(evaluatePredicate(pred('time_of_day', 'between', ['09:00', '18:00']), ctx({ time_of_day: '08:59' })), false);
      assert.equal(evaluatePredicate(pred('time_of_day', 'between', ['09:00', '18:00']), ctx({ time_of_day: '18:01' })), false);
    });
    it("'HH:mm' lexicográfico: extremos inclusivos", () => {
      assert.equal(evaluatePredicate(pred('time_of_day', 'between', ['09:00', '18:00']), ctx({ time_of_day: '09:00' })), true);
      assert.equal(evaluatePredicate(pred('time_of_day', 'between', ['09:00', '18:00']), ctx({ time_of_day: '18:00' })), true);
    });
    it('false si target no es par [min,max]', () => {
      assert.equal(evaluatePredicate(pred('weight_kg', 'between', [5]), ctx()), false);
      assert.equal(evaluatePredicate(pred('weight_kg', 'between', 5), ctx()), false);
    });
    it('false si el field es null', () => {
      assert.equal(evaluatePredicate(pred('weight_kg', 'between', [0, 100]), ctx({ weight_kg: null })), false);
    });
  });

  describe('contains', () => {
    it('sobre array: true si el set incluye exactamente el valor', () => {
      assert.equal(evaluatePredicate(pred('skus', 'contains', 'SKU-A'), ctx()), true);
      assert.equal(evaluatePredicate(pred('skus', 'contains', 'SKU-Z'), ctx()), false);
    });
    it('sobre string: substring case-insensitive', () => {
      assert.equal(evaluatePredicate(pred('postal_code', 'contains', '141'), ctx()), true);
      assert.equal(evaluatePredicate(pred('pricing_tier', 'contains', 'STAND'), ctx()), true);
      assert.equal(evaluatePredicate(pred('pricing_tier', 'contains', 'premium'), ctx()), false);
    });
    it('false si el field es null', () => {
      assert.equal(evaluatePredicate(pred('postal_code', 'contains', '1'), ctx({ postal_code: null })), false);
    });
  });
});

describe('evaluateRules — first-match', () => {
  it('gana la regla de mayor prioridad entre varias que matchean', () => {
    const rules = [
      rule({ id: 'low', priority: 1, conditions: [], action: { surcharge: 100 } }),
      rule({ id: 'high', priority: 10, conditions: [], action: { surcharge: 999 } }),
      rule({ id: 'mid', priority: 5, conditions: [], action: { surcharge: 500 } }),
    ];
    const res = evaluateRules(ctx(), rules);
    assert.equal(res.matched_rule_id, 'high');
    assert.equal(res.action.surcharge, 999);
  });

  it('desempate determinístico por id ASC cuando hay igual prioridad', () => {
    const rules = [
      rule({ id: 'b_rule', priority: 5, conditions: [], action: { surcharge: 2 } }),
      rule({ id: 'a_rule', priority: 5, conditions: [], action: { surcharge: 1 } }),
    ];
    const res = evaluateRules(ctx(), rules);
    assert.equal(res.matched_rule_id, 'a_rule');
    assert.equal(res.action.surcharge, 1);
  });

  it('regla sin condiciones = catch-all (matchea siempre)', () => {
    const rules = [rule({ id: 'fallback', priority: 0, conditions: [], action: { route_strategy: 'manual' } })];
    const res = evaluateRules(ctx(), rules);
    assert.equal(res.matched_rule_id, 'fallback');
    assert.equal(res.action.route_strategy, 'manual');
  });

  it('AND de condiciones: todas deben cumplir', () => {
    const rules = [
      rule({
        id: 'both',
        priority: 10,
        conditions: [pred('weight_kg', 'gt', 5), pred('zone_id', 'eq', 'zone_1')],
        action: { surcharge: 1 },
      }),
      rule({ id: 'fallback', priority: 1, conditions: [], action: { surcharge: 2 } }),
    ];
    // ambas condiciones se cumplen → gana 'both'
    assert.equal(evaluateRules(ctx(), rules).matched_rule_id, 'both');
    // una condición falla (zona distinta) → cae al fallback
    assert.equal(evaluateRules(ctx({ zone_id: 'zone_9' }), rules).matched_rule_id, 'fallback');
  });

  it('ignora reglas inactivas aunque tengan mayor prioridad', () => {
    const rules = [
      rule({ id: 'inactive_high', priority: 100, active: false, conditions: [], action: { surcharge: 999 } }),
      rule({ id: 'active_low', priority: 1, active: true, conditions: [], action: { surcharge: 1 } }),
    ];
    const res = evaluateRules(ctx(), rules);
    assert.equal(res.matched_rule_id, 'active_low');
  });

  it('sin match → matched_rule_id null y action vacía', () => {
    const rules = [
      rule({ id: 'never', priority: 10, conditions: [pred('zone_id', 'eq', 'NOPE')], action: { surcharge: 1 } }),
    ];
    const res = evaluateRules(ctx(), rules);
    assert.equal(res.matched_rule_id, null);
    assert.deepEqual(res.action, {});
  });

  it('lista de reglas vacía → sin match', () => {
    const res = evaluateRules(ctx(), []);
    assert.equal(res.matched_rule_id, null);
    assert.deepEqual(res.action, {});
  });
});
