import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAvailableBalance, sumAvailable } from './ledger';

test('earns and redeems net out on available entries', () => {
  const balance = computeAvailableBalance([
    { amount: 100, status: 'available' },
    { amount: 50, status: 'available' },
    { amount: -30, status: 'available' },
  ]);
  assert.equal(balance, 120);
});

test('pending / expired / reversed entries do not count', () => {
  const balance = computeAvailableBalance([
    { amount: 100, status: 'available' },
    { amount: 500, status: 'pending' },
    { amount: 200, status: 'expired' },
    { amount: 300, status: 'reversed' },
  ]);
  assert.equal(balance, 100);
});

test('a missing status is treated as available (legacy rows)', () => {
  const balance = computeAvailableBalance([
    { amount: 100 },
    { amount: -40, status: null },
  ]);
  assert.equal(balance, 60);
});

test('reverse / expire entries subtract from the balance', () => {
  const balance = computeAvailableBalance([
    { amount: 100, status: 'available' }, // earn
    { amount: -100, status: 'available' }, // reverse of the earn
  ]);
  assert.equal(balance, 0);
});

test('balance is floored at 0 even if the raw sum goes negative', () => {
  const entries = [
    { amount: 100, status: 'available' }, // earn
    { amount: -100, status: 'available' }, // redeem (spent)
    { amount: -100, status: 'available' }, // reverse of the earn after it was spent
  ];
  assert.equal(sumAvailable(entries), -100);
  assert.equal(computeAvailableBalance(entries), 0);
});
