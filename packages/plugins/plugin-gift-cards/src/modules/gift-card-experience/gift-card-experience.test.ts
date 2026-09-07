import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertGiftCardBuyerIsNotRecipient,
  giftCardConfigV1Schema,
  maskGiftCardCode,
  normalizeGiftCardConfig,
} from '../../lib/gift-cards-shared';
import { createGiftCardToken, decryptGiftCardToken, hashGiftCardToken } from './crypto';
import { nextDeliveryRetryAt, normalizeRetryDelays } from './backoff';
import { resolveScheduledAt, zonedDateTimeToUtc } from './schedule';
import { capturedAmount, isFullyPaidOrder, isUniqueConstraintError } from './process-order';
import { attributeGiftCardLedger, type StoreCreditLedgerTransaction } from './attribution';

test('normalizes legacy metadata and sanitizes gift-card text', () => {
  const value = normalizeGiftCardConfig({
    recipient_email: '  PERSON@example.com ', recipient_name: '<Ana>\u0000', message: '<b>Hola</b>',
  });
  assert.equal(value.delivery_mode, 'recipient');
  assert.equal(value.recipient_email, 'person@example.com');
  assert.equal(value.recipient_name, 'Ana');
  assert.equal(value.message, 'bHola/b');
  assert.throws(() => assertGiftCardBuyerIsNotRecipient(value, 'PERSON@example.com'));
});

test('rejects incomplete recipient contract and masks codes', () => {
  assert.equal(giftCardConfigV1Schema.safeParse({
    version: 1, delivery_mode: 'recipient', design_id: 'brand-default', anonymous: false, delivery: { type: 'now' },
  }).success, false);
  assert.equal(maskGiftCardCode('MRC-7PK4-X9DR-H2QM'), '•••• •••• H2QM');
});

test('encrypts random single-use tokens with authenticated encryption', () => {
  process.env.GIFT_CARD_TOKEN_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
  const created = createGiftCardToken();
  assert.equal(decryptGiftCardToken(created.encrypted), created.token);
  assert.equal(hashGiftCardToken(created.token), created.hash);
  const envelope = created.encrypted.split(':');
  const authenticationTag = Buffer.from(envelope[2]!, 'base64url');
  authenticationTag[0] ^= 0xff;
  envelope[2] = authenticationTag.toString('base64url');
  const tampered = envelope.join(':');
  assert.throws(() => decryptGiftCardToken(tampered));
});

test('uses configured delivery windows and bounded retry backoff', () => {
  const settings = {
    timezone: 'America/Argentina/Buenos_Aires', morning_time: '09:00', afternoon_time: '14:00', evening_time: '19:00',
    schedule_horizon_days: 365,
  } as any;
  assert.equal(zonedDateTimeToUtc('2026-07-20', '09:00', settings.timezone).toISOString(), '2026-07-20T12:00:00.000Z');
  assert.equal(resolveScheduledAt({ type: 'scheduled', date: '2026-07-20', window: 'evening' }, settings, new Date('2026-07-19T12:00:00Z'))?.toISOString(), '2026-07-20T22:00:00.000Z');
  assert.deepEqual(normalizeRetryDelays({ delays: [1, 5, 30, 120, 720] }), [1, 5, 30, 120, 720]);
  assert.equal(nextDeliveryRetryAt(6, [1, 5, 30, 120, 720]), null);
});

test('requires captured payments to cover the payable total', () => {
  const partial = { total: 100, payment_collections: [{ payments: [{ amount: 60, captured_at: new Date() }] }] } as any;
  assert.equal(capturedAmount(partial), 60);
  assert.equal(isFullyPaidOrder(partial), false);
  partial.payment_collections[0].payments.push({ amount: 40, captured_at: new Date() });
  assert.equal(isFullyPaidOrder(partial), true);
  partial.canceled_at = new Date();
  assert.equal(isFullyPaidOrder(partial), false);
});

test('retries only database uniqueness collisions', () => {
  assert.equal(isUniqueConstraintError({ code: '23505' }), true);
  assert.equal(isUniqueConstraintError(new Error('duplicate key value violates unique constraint')), true);
  assert.equal(isUniqueConstraintError(new Error('provider unavailable')), false);
});

test('attributes first use and exhaustion to gift-card lots with FIFO ledger ordering', () => {
  const at = (minute: number) => `2026-07-19T10:${String(minute).padStart(2, '0')}:00.000Z`;
  const transactions: StoreCreditLedgerTransaction[] = [
    { id: '1', account_id: 'wallet', amount: 20, type: 'credit', reference: 'refund', created_at: at(1) },
    { id: '2', account_id: 'wallet', amount: 50, type: 'credit', reference: 'store-credit', reference_id: 'gift-a', created_at: at(2) },
    { id: '3', account_id: 'wallet', amount: 30, type: 'credit', reference: 'store-credit', reference_id: 'gift-b', created_at: at(3) },
    { id: '4', account_id: 'wallet', amount: 30, type: 'debit', created_at: at(4) },
    { id: '5', account_id: 'wallet', amount: 40, type: 'debit', created_at: at(5) },
    { id: '6', account_id: 'wallet', amount: 10, type: 'debit', created_at: at(6) },
    { id: '7', account_id: 'wallet', amount: 20, type: 'debit', created_at: at(7) },
  ];
  const result = attributeGiftCardLedger(transactions, new Set(['gift-a', 'gift-b']));
  assert.equal(result.get('gift-a')?.remaining, 0);
  assert.equal(result.get('gift-a')?.first_used_at?.toISOString(), at(4));
  assert.equal(result.get('gift-a')?.exhausted_at?.toISOString(), at(5));
  assert.equal(result.get('gift-b')?.remaining, 0);
  assert.equal(result.get('gift-b')?.first_used_at?.toISOString(), at(6));
  assert.equal(result.get('gift-b')?.exhausted_at?.toISOString(), at(7));
});
