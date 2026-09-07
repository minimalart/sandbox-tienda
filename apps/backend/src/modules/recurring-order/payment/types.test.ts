import assert from 'node:assert/strict';
import test from 'node:test';
import { mercadoPagoRecurringCapabilities } from './mercadopago-auto';

test('Mercado Pago declara la reautorización obligatoria para cambios de agenda', () => {
  assert.equal(mercadoPagoRecurringCapabilities.updateSchedule, 'reauthorization_required');
  assert.equal(mercadoPagoRecurringCapabilities.updateAmount, true);
  assert.equal(mercadoPagoRecurringCapabilities.changePaymentMethod, true);
});
