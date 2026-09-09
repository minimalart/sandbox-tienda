import { registerCartValidation } from '@minimalart/mercatto-plugin-runtime';
import { completeCartWorkflow } from '@medusajs/core-flows';
import { MedusaError } from '@medusajs/framework/utils';
import { StepResponse } from '@medusajs/framework/workflows-sdk';
import { validateCheckoutCompletion, releaseCheckoutCompletion } from '../../modules/demo-store/checkout/runtime';
import { CheckoutError } from '../../modules/demo-store/checkout/assignments';

registerCartValidation(completeCartWorkflow, 'site-checkout', async ({ cart }, { container }) => {
  try { const cartId = await validateCheckoutCompletion(container, cart); return cartId; }
  catch (error) {
    if (error instanceof CheckoutError) throw new MedusaError(MedusaError.Types.INVALID_DATA, `${error.code}: ${error.message}`);
    throw error;
  }
}, async (cartId, { container }) => { await releaseCheckoutCompletion(container, cartId); }, (data) => new StepResponse(undefined, data));
