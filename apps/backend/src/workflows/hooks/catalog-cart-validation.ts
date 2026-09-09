import { registerCartValidation } from '@minimalart/mercatto-plugin-runtime';
import { StepResponse } from '@medusajs/framework/workflows-sdk';
import {
  addToCartWorkflow,
  createCartWorkflow,
  updateLineItemInCartWorkflow,
  completeCartWorkflow,
  updateCartWorkflow,
  transferCartCustomerWorkflow,
} from '@medusajs/core-flows';
import { validateCatalogLines } from '../../lib/catalog/cart-validation';
import { Modules } from '@medusajs/framework/utils';

registerCartValidation(createCartWorkflow, 'catalog', async ({ cart }, { container }) => {
  await validateCatalogLines(container, cart.items ?? []);
}, undefined, (data) => new StepResponse(undefined, data));

registerCartValidation(addToCartWorkflow, 'catalog', async ({ input, cart }, { container }) => {
  // The add workflow supplies pricing context only: its cart has no items.
  const stored = await (container.resolve(Modules.CART) as any).retrieveCart(cart.id, {
    relations: ['items'],
  });
  const lines = (stored.items ?? []).map((i: any) => ({ ...i }));
  for (const item of input.items ?? []) {
    const prior = lines.find((i: any) => i.variant_id === item.variant_id);
    if (prior) {
      prior.quantity = Number(prior.quantity) + Number(item.quantity);
      // A package line keeps its original snapshot when standard add-to-cart merges it.
      prior.metadata = { ...prior.metadata, ...item.metadata };
    } else lines.push(item as any);
  }
  await validateCatalogLines(container, lines);
}, undefined, (data) => new StepResponse(undefined, data));
registerCartValidation(updateLineItemInCartWorkflow, 'catalog', async ({ input, cart }, { container }) => {
  await validateCatalogLines(
    container,
    (cart.items ?? [])
      .map((item: any) =>
        item.id === input.item_id
          ? { ...item, ...input.update, metadata: { ...item.metadata, ...input.update.metadata } }
          : item
      )
      .filter((item: any) => Number(item.quantity) !== 0)
  );
}, undefined, (data) => new StepResponse(undefined, data));
registerCartValidation(completeCartWorkflow, 'catalog', async ({ cart }, { container }) => {
  await validateCatalogLines(container, cart.items ?? []);
}, undefined, (data) => new StepResponse(undefined, data));
registerCartValidation(updateCartWorkflow, 'catalog', async ({ cart }, { container }) => {
  await validateCatalogLines(container, cart.items ?? []);
}, undefined, (data) => new StepResponse(undefined, data));
registerCartValidation(transferCartCustomerWorkflow, 'catalog', async ({ cart }, { container }) => {
  const stored = await (container.resolve(Modules.CART) as any).retrieveCart(cart.id, {
    relations: ['items'],
  });
  await validateCatalogLines(container, stored.items ?? []);
}, undefined, (data) => new StepResponse(undefined, data));
