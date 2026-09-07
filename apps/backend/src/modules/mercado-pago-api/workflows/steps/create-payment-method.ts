import type { CreatePaymentMethodDTO, PaymentMethodDTO } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

/**
 * Saves a tokenized card as a MercadoPago payment method (MP Customer card) for
 * the resolved account holder, so the storefront can offer saved cards later.
 */
export const createMercadopagoApiPaymentMethodStep = createStep<
  CreatePaymentMethodDTO,
  PaymentMethodDTO | null,
  undefined
>('create-mercadopago-api-payment-method', async (data, { container }) => {
  const service = container.resolve(Modules.PAYMENT);
  const paymentMethod = await service.createPaymentMethods(data);
  return new StepResponse(paymentMethod);
});
