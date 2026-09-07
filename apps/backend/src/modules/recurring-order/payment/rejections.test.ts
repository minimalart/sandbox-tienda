import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMercadoPagoRejection } from './rejections';

test('clasifica rechazos corregibles con nueva tarjeta como definitivos', () => {
  assert.equal(
    classifyMercadoPagoRejection('cc_rejected_bad_filled_security_code'),
    'definitive',
  );
  assert.equal(classifyMercadoPagoRejection('cc_rejected_expired_card'), 'definitive');
});

test('mantiene saldo y errores transitorios dentro del dunning', () => {
  assert.equal(classifyMercadoPagoRejection('cc_rejected_insufficient_amount'), 'recoverable');
  assert.equal(classifyMercadoPagoRejection('rejected_by_bank'), 'recoverable');
  assert.equal(classifyMercadoPagoRejection('provider_timeout'), 'recoverable');
});
