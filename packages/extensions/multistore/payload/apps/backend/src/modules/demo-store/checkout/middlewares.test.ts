import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { cartIdFromPaymentCollection } from './middlewares.ts';

const scopeWith = (query: any, warnings: string[] = []) => ({
  resolve: (key: string) =>
    key === ContainerRegistrationKeys.QUERY
      ? query
      : { warn: (message: string) => warnings.push(message) },
});

describe('cart resolution from a payment collection', () => {
  it('asks the graph for the link entity Medusa actually registers', async () => {
    const seen: any[] = [];
    const cartId = await cartIdFromPaymentCollection(
      scopeWith({
        graph: async (input: any) => {
          seen.push(input);
          return { data: [{ cart_id: 'cart_1' }] };
        },
      }),
      'pay_col_1'
    );
    assert.equal(cartId, 'cart_1');
    // The graph entity is the snake_case link name — the same one the core store
    // route uses. `LINKS.CartPaymentCollection` is the model CLASS name
    // (`CartCartPaymentPaymentCollectionLink`) and leaves the request without a
    // response, which is a 504 on every store's payment route.
    assert.equal(seen[0].entity, 'cart_payment_collection');
    assert.deepEqual(seen[0].filters, { payment_collection_id: 'pay_col_1' });
  });
  it('returns null when the collection has no cart linked yet', async () =>
    assert.equal(
      await cartIdFromPaymentCollection(scopeWith({ graph: async () => ({ data: [] }) }), 'pay_col_1'),
      null
    ));
  it('fails open and warns: a broken lookup cannot take the payment route down', async () => {
    const warnings: string[] = [];
    const cartId = await cartIdFromPaymentCollection(
      scopeWith(
        {
          graph: async () => {
            throw new Error('entity not found');
          },
        },
        warnings
      ),
      'pay_col_1'
    );
    assert.equal(cartId, null);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /pay_col_1/);
  });
});
