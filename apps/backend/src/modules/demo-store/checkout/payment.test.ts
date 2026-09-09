import { it, describe } from 'node:test';
import assert from 'node:assert/strict';
import { assertPaymentMatchesCart } from './payment.ts';
const valid = () => ({
  total: 20,
  currency_code: 'ars',
  payment_collection: {
    amount: 20,
    currency_code: 'ars',
    payment_sessions: [{ id: 'a', amount: 20, currency_code: 'ars', status: 'pending' }],
  },
});
describe('provider authorization invariants', () => {
  for (const value of [undefined, null, NaN, Infinity, -Infinity, -1])
    it(`rejects invalid amount ${String(value)}`, () =>
      assert.throws(() => assertPaymentMatchesCart({ ...valid(), total: value })));
  for (const status of [
    'pending',
    'requires_more',
    'authorized',
    'captured',
    'pending_authorization',
  ])
    it(`allows ${status} for the exact outstanding balance`, () => {
      const c = valid();
      c.payment_collection.payment_sessions[0].status = status;
      assert.doesNotThrow(() => assertPaymentMatchesCart(c));
    });
  for (const status of ['pending', 'authorized', 'pending_authorization'])
    it(`rejects two processable sessions including ${status} to prevent double authorization`, () => {
      const c = valid();
      c.payment_collection.payment_sessions.push({
        ...c.payment_collection.payment_sessions[0],
        id: 'b',
        status,
      });
      assert.throws(() => assertPaymentMatchesCart(c));
    });
  it('ignores a rejected historical session', () => {
    const c = valid();
    c.payment_collection.payment_sessions.push({
      id: 'old',
      amount: 999,
      currency_code: 'usd',
      status: 'error',
    });
    assert.doesNotThrow(() => assertPaymentMatchesCart(c));
  });
  it('a valid session cannot hide another stale active session', () => {
    const c = valid();
    c.payment_collection.payment_sessions.unshift({
      id: 'stale',
      amount: 19,
      currency_code: 'ars',
      status: 'pending',
    });
    assert.throws(() => assertPaymentMatchesCart(c));
  });
  it('zero balance needs no payment session', () =>
    assert.doesNotThrow(() => assertPaymentMatchesCart({ total: 0 })));
  it('a partial credit leaves a payable balance', () =>
    assert.throws(() => assertPaymentMatchesCart({ total: 0.01, currency_code: 'ars' })));
  it('uses the net total, not subtotal before discounts and credits', () =>
    assert.doesNotThrow(() =>
      assertPaymentMatchesCart({ ...valid(), subtotal: 50, credit_line_total: 30 })
    ));
});
