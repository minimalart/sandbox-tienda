import { useQueryGraphStep } from '@medusajs/medusa/core-flows';
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import type { AccountHolderDTO, PaymentCustomerDTO } from '@medusajs/framework/types';
import { validateTransactionAmountStep, type ValidateTransactionStepInput } from './steps/validate-transaction-amount';
import { createMercadopagoApiPaymentStep } from './steps/create-payment';
import { createMercadopagoApiPaymentMethodStep } from './steps/create-payment-method';
import type { PostStoreMercadopagoPaymentType } from '../../../api/store/mercadopago/payment/validators';

type CreatePaymentWorkflowInput = {
  paymentSessionId: string;
  cartId: string;
  paymentData: PostStoreMercadopagoPaymentType['paymentData'];
  customerId?: string;
  deviceSessionId?: string;
};

/**
 * Orchestrates a MercadoPago Checkout API payment:
 *  1. validate the amount against the Medusa session,
 *  2. resolve the cart's sales channel (to pick the collecting MP account),
 *  3. create the payment in MP,
 *  4. best-effort save the card for logged-in customers with an account holder.
 */
export const createMercadopagoApiPaymentWorkflow = createWorkflow(
  'create-mercadopago-api-payment',
  ({ paymentSessionId, cartId, paymentData, customerId, deviceSessionId }: CreatePaymentWorkflowInput) => {
    // @ts-ignore — loosely typed graph result
    const { data: paymentSession } = useQueryGraphStep({
      entity: 'payment_session',
      fields: ['amount', 'provider_id'],
      filters: { id: paymentSessionId },
      options: { throwIfKeyNotFound: true, isList: false },
    }).config({ name: 'get-payment-session' });

    const { data: cart } = useQueryGraphStep({
      entity: 'cart',
      fields: ['id', 'sales_channel_id'],
      filters: { id: cartId },
      options: { throwIfKeyNotFound: true, isList: false },
    }).config({ name: 'get-cart' });

    const validateInput: ValidateTransactionStepInput = transform(
      { paymentSession, paymentData },
      ({ paymentSession, paymentData }) => ({
        medusaAmount: Number(paymentSession.amount),
        transactionAmount: paymentData.transaction_amount ?? 0,
      }),
    );
    validateTransactionAmountStep(validateInput);

    const salesChannelId = transform({ cart }, ({ cart }) => cart?.sales_channel_id ?? null);

    const updatedPaymentSession = createMercadopagoApiPaymentStep({
      paymentSessionId,
      paymentData,
      deviceSessionId,
      cartId,
      salesChannelId,
    });

    const { data: customer } = useQueryGraphStep({
      entity: 'customer',
      fields: [
        'id',
        'email',
        'company_name',
        'first_name',
        'last_name',
        'phone',
        'addresses.*',
        'account_holders.*',
        'metadata',
      ],
      filters: { id: customerId },
      options: { isList: false },
    }).config({ name: 'get-customer' });

    const existentAccountHolder = transform(
      { customer, paymentSession },
      ({ customer, paymentSession }) => {
        if (!customer) return undefined;
        return customer.account_holders?.filter(
          (ah: { provider_id?: string }) => ah.provider_id === paymentSession.provider_id,
        )?.[0] as AccountHolderDTO | undefined;
      },
    );

    when(
      { customerId, customer, existentAccountHolder, paymentData },
      (data) =>
        !!data.customerId &&
        !!data.customer &&
        !!data.existentAccountHolder &&
        !!(data.paymentData as { token?: string }).token,
    ).then(() => {
      const paymentCustomer = transform({ customer }, ({ customer }) => ({
        ...customer,
        billing_address:
          customer.addresses?.find((a: { is_default_billing?: boolean }) => a.is_default_billing) ??
          customer.addresses?.[0] ??
          null,
      })) as unknown as PaymentCustomerDTO;

      const accountHolderPaymentMethodsInput = transform(
        { paymentSession, paymentCustomer, paymentData, existentAccountHolder },
        ({ paymentSession, paymentCustomer, existentAccountHolder, paymentData }) => ({
          provider_id: paymentSession.provider_id,
          data: paymentData,
          context: {
            account_holder: existentAccountHolder,
            customer: paymentCustomer,
            idempotency_key: (paymentData as { token?: string }).token ?? paymentSession.provider_id,
          },
        }),
      );

      createMercadopagoApiPaymentMethodStep(
        accountHolderPaymentMethodsInput as never,
      ).config({ continueOnPermanentFailure: true });
    });

    return new WorkflowResponse(updatedPaymentSession);
  },
);
