import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CheckoutPolicySchema, resolveCheckoutPolicy, mergeCheckoutPolicy } from './policy.ts';
import { assertCoverage, reconcileUnits, validatePeople, mapOrderUnits, cartFingerprint, PersonSchema } from './assignments.ts';
import { effectiveFlow, cartSite, policyVersion } from './runtime.ts';

const policy = resolveCheckoutPolicy({ recipients: { enabled: true } });
const person = () => ({ id: randomUUID(), document: '30111222', first_name: 'Persona', last_name: 'Prueba' });
const line = (id = 'line-a', quantity = 2) => ({ id, product_id: 'product-a', variant_id: 'variant-a', quantity, metadata: { checkout_line_key: id } });

describe('per-site checkout policy', () => {
  it('preserves legacy defaults and explicit false with field inheritance', () => {
    assert.equal(resolveCheckoutPolicy().recipients.enabled, false);
    // El carrusel de sugerencias arranca prendido y cada tienda puede apagarlo.
    assert.equal(resolveCheckoutPolicy().suggestions.enabled, true);
    assert.equal(resolveCheckoutPolicy({ suggestions: { enabled: false } }).suggestions.enabled, false);
    assert.equal(mergeCheckoutPolicy({ suggestions: { enabled: false } }, {}).suggestions.enabled, false);
    const a = mergeCheckoutPolicy({ steps: { contact: false, payment: false } }, { steps: { address: false } });
    assert.equal(a.steps.contact, false); assert.equal(a.steps.payment, false); assert.equal(a.steps.address, false); assert.equal(a.steps.delivery, true);
    a.recipients.product_ids.push('test'); assert.deepEqual(resolveCheckoutPolicy().recipients.product_ids, []);
  });
  it('rejects null, unknown keys, HTML, invalid retention and nonboolean visibility', () => {
    for (const value of [null, { steps: null }, { steps: { address: 'false' } }, { disable_validation: true }, { steps: { stock: false } }, { sections: { contact: { title: '<script>' } } }, { sections: { contact: { foo: 'bar' } } }, { recipients: { retention_days: 0 } }]) assert.equal(CheckoutPolicySchema.safeParse(value).success, false);
  });
  it('hides configured steps and marks the flow not ready when data is missing', () => {
    const p = resolveCheckoutPolicy({ steps: { address: false, contact: false, delivery: false } });
    const flow = effectiveFlow({ items: [{ requires_shipping: true }], total: 10 }, p, true);
    assert.equal(flow.ready, false); assert.equal(flow.blocks.find(b => b.id === 'address')?.visible, false);
    assert.equal(flow.blocks.find(b => b.id === 'personal')?.visible, false);
  });
  it('omits delivery for digital carts and home addresses for verified pickup', () => {
    const digital = effectiveFlow({ email: 'fixture@example.test', items: [{ requires_shipping: false }], total: 0 }, policy, true);
    assert.equal(digital.address_required, false); assert.equal(digital.shipping_required, false); assert.equal(digital.ready, true);
    const pickup = effectiveFlow({ email: 'fixture@example.test', items: [{ requires_shipping: true }], checkout_pickup: true, shipping_methods: [{}], total: 10 }, policy, true);
    assert.equal(pickup.address_required, false); assert.equal(pickup.shipping_required, true);
    const forged = effectiveFlow({ items: [{ requires_shipping: true }], shipping_methods: [{ data: { fulfillment_type: 'pickup' } }] }, policy, true);
    assert.equal(forged.address_required, true);
  });
  it('module absence is a compatible no-op', async () => {
    assert.equal(await cartSite({ resolve: () => { throw new Error('absent'); } }, {}), null);
  });
  it('resolves benefits default and honours explicit step overrides', () => {
    const resolved = resolveCheckoutPolicy({ steps: { address: false } });
    assert.equal(resolved.steps.address, false);
    assert.equal(resolved.steps.benefits, true);
  });
  it('preserves sections without dropping other keys and rejects unknown section fields', () => {
    const resolved = resolveCheckoutPolicy({ sections: { contact: { title: 'Hola' } } });
    assert.deepEqual(resolved.sections, { contact: { title: 'Hola' } });
    const merged = mergeCheckoutPolicy({ sections: { address: { title: 'Envío' } } }, { sections: { contact: { subtitle: 'Escribinos' } } });
    assert.equal(merged.sections.address?.title, 'Envío');
    assert.equal(merged.sections.contact?.subtitle, 'Escribinos');
    assert.equal(CheckoutPolicySchema.safeParse({ sections: { contact: { unknown: 'x' } } }).success, false);
  });
  it('strips legacy recipients.title and recipients.help so old JSON in DB still parses', () => {
    const legacy = { recipients: { enabled: true, title: 'Alumno', help: 'Indicá quién recibirá cada artículo.' } };
    const parsed = CheckoutPolicySchema.safeParse(legacy);
    assert.equal(parsed.success, true);
    assert.equal((parsed as any).data.recipients.enabled, true);
    assert.equal('title' in (parsed as any).data.recipients, false);
    assert.equal('help' in (parsed as any).data.recipients, false);
  });
  it('policyVersion is stable across parse: legacy JSON hashes the same as its stripped form', () => {
    // Sin parse, resolveCheckoutPolicy spreadea recipients.title/help sobre el output y el hash cambia.
    // writePolicy dependía de eso; el bug reventaba con CHECKOUT_REVISION_CONFLICT en cada save.
    const legacyRaw = { recipients: { enabled: true, title: 'Alumno', help: 'Indicá quién recibirá cada artículo.' } };
    const legacyParsed = CheckoutPolicySchema.parse(legacyRaw);
    assert.equal(policyVersion(resolveCheckoutPolicy(legacyParsed)), policyVersion(resolveCheckoutPolicy(legacyParsed)));
    assert.notEqual(policyVersion(resolveCheckoutPolicy(legacyRaw as any)), policyVersion(resolveCheckoutPolicy(legacyParsed)));
  });
});
describe('recipient unit identity', () => {
  it('deduplicates within the cart and normalizes document input', () => {
    const a = person(); assert.equal(PersonSchema.parse({ ...a, document: '30.111.222' }).document, '30111222');
    assert.throws(() => validatePeople([a, { ...a, id: randomUUID(), first_name: 'Otra' }]), /nombres distintos/);
  });
  it('assigns one person across products and validates per-unit coverage', () => {
    const p = person(); const lines = [line(), { ...line('line-b', 1), variant_id: 'variant-b' }];
    const { units } = reconcileUnits([], lines, policy, p.id);
    assert.equal(units.length, 3); assertCoverage(units, [p], lines, policy);
    assert.throws(() => assertCoverage(units.slice(1), [p], lines, policy), /todas las unidades/);
  });
  it('preserves stable IDs through reordering, growth and known line fusion', () => {
    const p = person(); const initial = reconcileUnits([], [line('a', 1), line('b', 1)], policy, p.id).units;
    const merged = reconcileUnits(initial, [line('a', 2)], policy, p.id).units;
    assert.deepEqual(new Set(merged.map(u => u.id)), new Set(initial.map(u => u.id)));
    assertCoverage(merged, [p], [line('a', 2)], policy);
    const more = reconcileUnits(merged, [line('a', 3)], policy, null).units;
    assert.equal(more[2].person_id, null);
  });
  it('requires explicit retained units when decreasing mixed recipients', () => {
    const a = person(), b = { ...person(), document: '30111223' };
    const units = reconcileUnits([], [line()], policy, a.id).units; units[1].person_id = b.id;
    assert.deepEqual(reconcileUnits(units, [line('line-a', 1)], policy, null).conflicts, ['line-a']);
    const retained = reconcileUnits(units, [line('line-a', 1)], policy, null, [units[1].id]).units;
    assert.equal(retained[0].person_id, b.id);
  });
  it('never accepts foreign units or a forged order mapping key', () => {
    const p = person(); const units = reconcileUnits([], [line()], policy, p.id).units;
    assert.throws(() => assertCoverage([...units, { ...units[0], id: randomUUID(), line_id: 'foreign' }], [p], [line()], policy));
    assert.throws(() => assertCoverage(units, [p], [{ ...line(), metadata: { checkout_line_key: 'forged' } }], policy));
    assert.throws(() => mapOrderUnits(units, [{ id: 'orderline', metadata: {} }]));
    assert.equal(mapOrderUnits(units, [{ id: 'orderline', metadata: { checkout_line_key: 'line-a' } }])[0].order_line_id, 'orderline');
  });
  it('ignores shipping address projection differences but detects monetary or quantity changes', () => {
    const cart = { email: 'fixture@example.test', total: 10, items: [line()], shipping_address: { city: 'Ciudad', address_1: 'Calle', country_code: 'ar' } };
    assert.equal(cartFingerprint(cart), cartFingerprint({ ...cart, shipping_address: { ...cart.shipping_address, created_at: 'different', id: 'address_2' } }));
    // completeCartFields projects customer.* and region.* instead of their FK fields.
    assert.equal(cartFingerprint({ ...cart, customer_id: 'customer-a', region_id: 'region-a' }), cartFingerprint({ ...cart, customer: { id: 'customer-a' }, region: { id: 'region-a' } }));
    assert.notEqual(cartFingerprint({ ...cart, shipping_methods: [{ shipping_option_id: 'pickup', amount: 0, data: { branch_id: 'a' } }] }), cartFingerprint({ ...cart, shipping_methods: [{ shipping_option_id: 'pickup', amount: 0, data: { branch_id: 'b' } }] }));
    // `total` NO entra en el fingerprint a proposito (ver cartFingerprintComponents):
    // q.graph y el cart refrescado por completeCartWorkflow divergen en ese campo y
    // daban CHECKOUT_REVISION_CONFLICT falsos al finalizar. El precio se protege por
    // items[unit_price] + shipping_methods[amount] + assertPaymentMatchesCart.
    assert.equal(cartFingerprint(cart), cartFingerprint({ ...cart, total: 11 }));
    assert.notEqual(cartFingerprint(cart), cartFingerprint({ ...cart, items: [{ ...line(), unit_price: 999 }] }));
    assert.notEqual(cartFingerprint(cart), cartFingerprint({ ...cart, items: [line('line-a', 3)] }));
  });
  it('selected products only and disabled capability leave other units untouched', () => {
    const selected = resolveCheckoutPolicy({ recipients: { enabled: true, scope: 'selected', product_ids: ['product-b'] } });
    assert.deepEqual(reconcileUnits([], [line()], selected, null).units, []);
    assertCoverage([], [], [line()], resolveCheckoutPolicy());
  });
});
