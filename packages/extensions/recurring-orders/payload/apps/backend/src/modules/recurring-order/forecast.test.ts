import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateSubscriptionDemand } from './forecast';

test('agrega demanda 14/30 y descuenta stock reservado del disponible recibido', () => {
  const now = new Date('2026-09-01T12:00:00.000Z');
  const rows = aggregateSubscriptionDemand(
    [
      { variant_id: 'v1', quantity: 3, sales_channel_id: 'sc1', recurring_order_id: 'r1', scheduled_at: '2026-09-10T12:00:00.000Z' },
      { variant_id: 'v1', quantity: 4, sales_channel_id: 'sc1', recurring_order_id: 'r2', scheduled_at: '2026-09-20T12:00:00.000Z' },
    ],
    new Map([['v1', 5]]),
    now,
  );
  assert.equal(rows[0].required_14d, 3);
  assert.equal(rows[0].required_30d, 7);
  assert.equal(rows[0].deficit_14d, 0);
  assert.equal(rows[0].deficit_30d, 2);
});

test('separa la demanda y el disponible por ubicación logística', () => {
  const now = new Date('2026-09-01T12:00:00.000Z');
  const rows = aggregateSubscriptionDemand(
    [
      { variant_id: 'v1', quantity: 3, sales_channel_id: 'sc1', location_id: 'loc_a', location_name: 'Centro', recurring_order_id: 'r1', scheduled_at: '2026-09-10T12:00:00.000Z' },
      { variant_id: 'v1', quantity: 3, sales_channel_id: 'sc1', location_id: 'loc_b', location_name: 'Norte', recurring_order_id: 'r2', scheduled_at: '2026-09-10T12:00:00.000Z' },
    ],
    new Map([['loc_a:v1', 5], ['loc_b:v1', 1], ['v1', 6]]),
    now,
  );
  const centro = rows.find((row) => row.location_id === 'loc_a');
  const norte = rows.find((row) => row.location_id === 'loc_b');
  assert.equal(centro?.deficit_14d, 0);
  assert.equal(norte?.deficit_14d, 2);
  assert.equal(norte?.location_name, 'Norte');
});
