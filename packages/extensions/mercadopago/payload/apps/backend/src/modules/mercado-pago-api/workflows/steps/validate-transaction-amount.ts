import { MedusaError } from '@medusajs/framework/utils';
import { createStep } from '@medusajs/framework/workflows-sdk';

export type ValidateTransactionStepInput = {
  transactionAmount: number;
  medusaAmount: number;
};

/**
 * Guards against a tampered client amount: the amount MP is asked to charge must
 * match the Medusa payment session amount (within rounding tolerance).
 */
export const validateTransactionAmountStep = createStep<ValidateTransactionStepInput, void, undefined>(
  'validate-mercadopago-api-transaction-amount',
  async ({ transactionAmount, medusaAmount }) => {
    if (Math.abs(medusaAmount - transactionAmount) > 0.01) {
      throw new MedusaError(
        MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR,
        "Medusa amount doesn't match MercadoPago amount, unable to generate payment",
      );
    }
  },
);
