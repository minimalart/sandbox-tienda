import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MedusaContainer } from '@medusajs/framework/types';
import { resolveOrderIdFromPayment } from './order-from-payment.ts';

type GraphInput = {
  entity: string;
  fields: string[];
  filters: Record<string, unknown>;
};

const containerWith = (
  responses: Record<string, Array<Record<string, unknown>>>,
  calls: GraphInput[] = []
): MedusaContainer =>
  ({
    resolve: () => ({
      graph: async (input: GraphInput) => {
        calls.push(input);
        return { data: responses[input.entity] ?? [] };
      },
    }),
  }) as unknown as MedusaContainer;

describe('resolveOrderIdFromPayment', () => {
  it('payment → payment_collection → order_payment_collection → order_id', async () => {
    const calls: GraphInput[] = [];
    const container = containerWith(
      {
        payment: [{ id: 'pay_1', payment_collection_id: 'paycol_1' }],
        order_payment_collection: [{ order_id: 'order_1' }],
      },
      calls
    );

    assert.equal(await resolveOrderIdFromPayment(container, 'pay_1'), 'order_1');
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].filters, { id: 'pay_1' });
    assert.deepEqual(calls[1].filters, { payment_collection_id: 'paycol_1' });
  });

  it('pago inexistente → undefined sin consultar el link', async () => {
    const calls: GraphInput[] = [];
    const container = containerWith({ payment: [] }, calls);

    assert.equal(await resolveOrderIdFromPayment(container, 'pay_x'), undefined);
    assert.equal(calls.length, 1);
  });

  it('pago sin payment_collection → undefined', async () => {
    const container = containerWith({
      payment: [{ id: 'pay_1', payment_collection_id: null }],
    });

    assert.equal(await resolveOrderIdFromPayment(container, 'pay_1'), undefined);
  });

  it('colección aún sin orden linkeada (carrera de webhooks) → undefined', async () => {
    const container = containerWith({
      payment: [{ id: 'pay_1', payment_collection_id: 'paycol_1' }],
      order_payment_collection: [],
    });

    assert.equal(await resolveOrderIdFromPayment(container, 'pay_1'), undefined);
  });
});
