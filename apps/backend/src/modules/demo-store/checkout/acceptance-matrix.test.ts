import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { STEP_KEYS, CheckoutPolicySchema, resolveCheckoutPolicy } from './policy.ts';
import {
  PersonSchema,
  reconcileUnits,
  assertCoverage,
  cartFingerprint,
  maskedPeople,
  mapOrderUnits,
} from './assignments.ts';
import { effectiveFlow } from './runtime.ts';
const person = (document = '30111222') => ({
  id: randomUUID(),
  document,
  first_name: 'Persona',
  last_name: 'Prueba',
});
const line = (id = 'a', quantity = 2, variant = id) => ({
  id,
  quantity,
  variant_id: variant,
  product_id: 'p-' + id,
  requires_shipping: false,
  unit_price: 10,
  metadata: { checkout_line_key: 'key-' + id },
});
const cart = () => ({
  id: 'cart',
  customer_id: 'customer',
  sales_channel_id: 'channel',
  region_id: 'region',
  currency_code: 'ars',
  email: 'fixture@example.test',
  total: 20,
  items: [line()],
  shipping_methods: [],
  metadata: {},
});
const policy = resolveCheckoutPolicy({ recipients: { enabled: true } });
describe('presentation combinations cannot bypass purchase requirements', () => {
  const bitOf = (key: (typeof STEP_KEYS)[number]) => STEP_KEYS.indexOf(key);
  const on = (mask: number, key: (typeof STEP_KEYS)[number]) => !!(mask & (1 << bitOf(key)));
  const total = 1 << STEP_KEYS.length;
  for (let mask = 0; mask < total; mask++)
    it(`visibility mask ${mask.toString(2).padStart(STEP_KEYS.length, '0')}`, () => {
      const p = resolveCheckoutPolicy({
          steps: Object.fromEntries(STEP_KEYS.map((key, i) => [key, !!(mask & (1 << i))])),
          recipients: { enabled: true },
        }),
        base = cart();
      const digital = effectiveFlow(base, p, true);
      assert.equal(digital.ready, true);
      assert.equal(digital.address_required, false);
      assert.equal(digital.shipping_required, false);
      for (const id of ['address', 'delivery'])
        assert.equal(digital.blocks.find((b) => b.id === id)?.visible, false);
      for (const [change, complete, id, key] of [
        [{ email: '' }, true, 'personal', 'contact'],
        [{}, false, 'recipients', null],
      ] as const) {
        const flow = effectiveFlow({ ...base, ...change }, p, complete);
        assert.equal(flow.ready, false);
        const expectedVisible = key === null ? true : on(mask, key);
        assert.equal(flow.blocks.find((b) => b.id === id)?.visible, expectedVisible);
      }
      const physical = {
        ...base,
        items: [{ ...line(), requires_shipping: true }, line('digital')],
      };
      const missing = effectiveFlow(physical, p, true);
      assert.equal(missing.ready, false);
      assert.equal(missing.address_required, true);
      assert.equal(missing.shipping_required, true);
      for (const [id, key] of [['address', 'address'], ['delivery', 'delivery']] as const)
        assert.equal(missing.blocks.find((b) => b.id === id)?.visible, on(mask, key));
      const delivered = {
        ...physical,
        shipping_address: { address_1: 'Calle', city: 'Ciudad', country_code: 'ar' },
        shipping_methods: [{ shipping_option_id: 'shipping' }],
        checkout_shipping_valid: true,
      };
      assert.equal(effectiveFlow(delivered, p, true).ready, true);
      assert.equal(
        effectiveFlow({ ...delivered, checkout_shipping_valid: false }, p, true).ready,
        false
      );
      const pickup = effectiveFlow(
        {
          ...physical,
          checkout_pickup: true,
          checkout_shipping_valid: true,
          shipping_methods: [{}],
        },
        p,
        true
      );
      assert.equal(pickup.ready, true);
      assert.equal(pickup.address_required, false);
      const choice = effectiveFlow({ ...physical, checkout_pickup_only: true }, p, true);
      assert.equal(choice.ready, false);
      assert.equal(choice.address_required, false);
      assert.equal(choice.blocks.find((b) => b.id === 'delivery')?.visible, on(mask, 'delivery'));
      const invoice = effectiveFlow({ ...base, metadata: { invoice_type: 'invoice_a' } }, p, true);
      assert.equal(invoice.ready, false);
      assert.equal(invoice.blocks.find((b) => b.id === 'billing')?.visible, on(mask, 'billing'));
      assert.equal(
        effectiveFlow({ ...base, total: 0 }, p, true).blocks.find((b) => b.id === 'payment')
          ?.visible,
        false
      );
      assert.deepEqual(
        digital.blocks.map((b) => b.id),
        [
          'personal',
          'address',
          'delivery',
          'billing',
          'recipients',
          'benefits',
          'payment',
          'review',
        ]
      );
    });
});
describe('untrusted policy and person input', () => {
  const invalid = {
    null: null,
    array: [],
    unknown: { enabled: true },
    nullSteps: { steps: null },
    stringBool: { steps: { contact: 'false' } },
    unknownStep: { steps: { validation: false } },
    nullRecipients: { recipients: null },
    badScope: { recipients: { scope: 'customer' } },
    // El copy de la sección se movió de `recipients.{title,help}` a
    // `sections.recipients.{title,subtitle}` (ver el comentario en `policy.ts`).
    // Estos cuatro casos seguían apuntando al lugar viejo, y ahí `recipients`
    // NO es `.strict()` a propósito —Zod strippea la clave legacy para no
    // romper `readPolicy` con la data que ya está en la base—, así que
    // `safeParse` daba `success: true` y el test fallaba sin que se hubiera
    // perdido ninguna validación: `text()` sigue aplicando el largo Y la regla
    // anti-HTML, ahora sobre `sections`.
    emptyTitle: { sections: { recipients: { title: ' ' } } },
    longTitle: { sections: { recipients: { title: 'a'.repeat(101) } } },
    html: { sections: { recipients: { subtitle: '<b>test</b>' } } },
    longHelp: { sections: { recipients: { subtitle: 'a'.repeat(501) } } },
    unknownSectionCopy: { sections: { recipients: { help: 'x' } } },
    unknownSection: { sections: { validation: { title: 'x' } } },
    foreignDocument: { recipients: { document_type: 'passport' } },
    foreignCountry: { recipients: { country: 'US' } },
    zeroRetention: { recipients: { retention_days: 0 } },
    largeRetention: { recipients: { retention_days: 91 } },
    fractionRetention: { recipients: { retention_days: 1.5 } },
    stringRetention: { recipients: { retention_days: '7' } },
    blankProduct: { recipients: { product_ids: [''] } },
  };
  for (const [name, value] of Object.entries(invalid))
    it(`rejects ${name}`, () => assert.equal(CheckoutPolicySchema.safeParse(value).success, false));

  /**
   * La contracara del bloque de arriba, y va explícita para que no se "arregle"
   * poniéndole `.strict()` a `recipients`: el copy viejo en la base tiene que
   * seguir parseando. Zod strippea la clave y `readPolicy` no se rompe.
   */
  for (const legacy of [{ recipients: { title: ' ' } }, { recipients: { help: '<b>x</b>' } }])
    it(`acepta y strippea el copy legacy ${JSON.stringify(legacy)}`, () => {
      const parsed = CheckoutPolicySchema.safeParse(legacy);
      assert.equal(parsed.success, true, 'la data que ya está en la base no puede dejar de parsear');
      assert.equal(
        'title' in (parsed.data?.recipients ?? {}) || 'help' in (parsed.data?.recipients ?? {}),
        false,
        'la clave legacy se strippea: el copy vive en sections'
      );
    });
  for (const document of ['123456', '123456789', 'abcd1234', '12/345678', '１２３４５６７８'])
    it(`rejects DNI ${JSON.stringify(document)}`, () =>
      assert.equal(PersonSchema.safeParse({ ...person(), document }).success, false));
  // El DNI es opcional desde 930a097bd: el formulario manda '' cuando queda vacio
  // y eso tiene que valer como "sin documento", no como un DNI invalido.
  for (const document of ['', '  ', '.-'])
    it(`acepta DNI vacio ${JSON.stringify(document)} como sin documento`, () => {
      const parsed = PersonSchema.safeParse({ ...person(), document });
      assert.equal(parsed.success, true);
      assert.equal(parsed.data?.document, undefined);
    });
  for (const document of ['1234567', '30.111.222', '30 111 222', '30-111-222'])
    it(`normalizes DNI ${document}`, () =>
      assert.match(PersonSchema.parse({ ...person(), document }).document, /^\d{7,8}$/));
  for (const field of ['first_name', 'last_name'])
    for (const value of ['', ' ', 'a'.repeat(101)])
      it(`rejects ${field} length ${value.length}`, () =>
        assert.equal(PersonSchema.safeParse({ ...person(), [field]: value }).success, false));
  it('does not alias caller product arrays across policy resolutions', () => {
    const input = { recipients: { product_ids: ['p-a'] } };
    resolveCheckoutPolicy(input).recipients.product_ids.push('foreign');
    assert.deepEqual(input.recipients.product_ids, ['p-a']);
  });
});
describe('stable unit identity and hostile references', () => {
  it('reordering lines preserves people and unit IDs', () => {
    const a = person(),
      b = person('30111223'),
      lines = [line('a'), line('b')];
    const units = reconcileUnits([], lines, policy, a.id).units;
    units.filter((u) => u.line_id === 'b').forEach((u) => (u.person_id = b.id));
    const next = reconcileUnits(units, [...lines].reverse(), policy, null).units;
    const sorted = (a: any[]) => [...a].sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(sorted(next), sorted(units));
    assertCoverage(next, [a, b], lines, policy);
  });
  it('deletion and variant replacement never transfer a person to a different product', () => {
    const p = person(),
      before = reconcileUnits([], [line()], policy, p.id).units;
    for (const lines of [[line('b')], [line('a', 2, 'new')]])
      assert.ok(
        reconcileUnits(before, lines, policy, null).units.every((u) => u.person_id === null)
      );
  });
  it('ambiguous same-variant surviving lines cannot adopt a deleted line', () => {
    const p = person(),
      before = reconcileUnits([], [line('gone', 1, 'same')], policy, p.id).units;
    const next = reconcileUnits(
      before,
      [line('a', 1, 'same'), line('b', 1, 'same')],
      policy,
      null
    ).units;
    assert.ok(next.every((u) => u.person_id === null));
    assert.equal(new Set(next.map((u) => u.id)).size, 2);
  });
  for (const mutation of ['person', 'line', 'variant', 'key', 'duplicate', 'missing'])
    it(`rejects ${mutation} assignment corruption`, () => {
      const p = person(),
        lines = [line()],
        units = reconcileUnits([], lines, policy, p.id).units;
      if (mutation === 'person') units[0].person_id = randomUUID();
      if (mutation === 'line') units[0].line_id = 'foreign';
      if (mutation === 'variant') units[0].variant_id = 'foreign';
      if (mutation === 'key') units[0].line_key = 'foreign';
      if (mutation === 'duplicate') units[1].id = units[0].id;
      if (mutation === 'missing') units.pop();
      assert.throws(() => assertCoverage(units, [p], lines, policy));
    });
  it('duplicate people and inconsistent names are rejected', () => {
    const p = person(),
      units = reconcileUnits([], [line()], policy, p.id).units;
    assert.throws(() => assertCoverage(units, [p, p], [line()], policy));
    assert.throws(() =>
      assertCoverage(units, [p, { ...p, id: randomUUID(), first_name: 'Otra' }], [line()], policy)
    );
  });
  it('explicit reduction keeps exactly the selected person', () => {
    const a = person(),
      b = person('30111223'),
      units = reconcileUnits([], [line()], policy, a.id).units;
    units[1].person_id = b.id;
    for (const keep of [[], units.map((u) => u.id), ['foreign']])
      assert.throws(() => reconcileUnits(units, [line('a', 1)], policy, null, keep));
    const next = reconcileUnits(units, [line('a', 1)], policy, null, [units[1].id]).units;
    assert.equal(next[0].id, units[1].id);
    assert.equal(next[0].person_id, b.id);
  });
  it('order mapping uses opaque keys when repeated SKUs and arrays reorder', () => {
    const p = person(),
      units = reconcileUnits([], [line('a', 1, 'same'), line('b', 1, 'same')], policy, p.id).units,
      orders = [
        { id: 'order-b', metadata: { checkout_line_key: 'key-b' } },
        { id: 'order-a', metadata: { checkout_line_key: 'key-a' } },
      ];
    assert.deepEqual(
      mapOrderUnits(units, orders).map((u) => u.order_line_id),
      ['order-a', 'order-b']
    );
    assert.throws(() => mapOrderUnits(units, [...orders, orders[0]]));
  });
  it('masked output does not mutate or disclose original DNI', () => {
    const p = person(),
      masked = maskedPeople([p]);
    assert.equal(p.document, '30111222');
    assert.equal(masked[0].document, '••••222');
    assert.ok(!JSON.stringify(masked).includes(p.document));
  });
});
describe('snapshot freshness', () => {
  for (const field of [
    'customer_id',
    'sales_channel_id',
    'region_id',
    'currency_code',
    'email',
  ])
    it(`invalidates ${field}`, () => {
      const a = cart();
      assert.notEqual(cartFingerprint(a), cartFingerprint({ ...a, [field]: 'other' }));
    });
  // `total` se excluye a proposito (ver cartFingerprintComponents): q.graph y el
  // cart refrescado por completeCartWorkflow divergen en ese campo (undefined vs
  // calculado) y daban CHECKOUT_REVISION_CONFLICT falsos al finalizar. El precio
  // lo cubren items[unit_price], shipping_methods[amount] y assertPaymentMatchesCart.
  it('total alone does not invalidate', () => {
    const a = cart();
    assert.equal(cartFingerprint(a), cartFingerprint({ ...a, total: 21 }));
  });
  for (const field of ['quantity', 'variant_id', 'unit_price'])
    it(`invalidates item ${field}`, () => {
      const a = cart(),
        b = structuredClone(a);
      (b.items[0] as any)[field] = field === 'variant_id' ? 'other' : 3;
      assert.notEqual(cartFingerprint(a), cartFingerprint(b));
    });
  it('line ordering alone does not invalidate', () => {
    const a = { ...cart(), items: [line('a'), line('b')] };
    assert.equal(cartFingerprint(a), cartFingerprint({ ...a, items: [...a.items].reverse() }));
  });
  it('billing changes invalidate even at the same total', () => {
    const a = cart();
    assert.notEqual(
      cartFingerprint(a),
      cartFingerprint({ ...a, metadata: { billing_snapshot: { id: 'changed' } } })
    );
  });
});
