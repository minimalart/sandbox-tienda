import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework';
import { MedusaError } from '@medusajs/framework/utils';
import { createMercadopagoApiPaymentWorkflow } from '../../../../modules/mercado-pago-api/workflows/create-payment';
import type { PostStoreMercadopagoPaymentType } from './validators';

/**
 * Creates a MercadoPago Checkout API payment from the tokenized Brick payload.
 * Supports card (token + installments) and cash/ticket (Rapipago / Pago Fácil).
 * The order is completed by the `/mercado-pago-api` webhook once MP notifies.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<PostStoreMercadopagoPaymentType>,
  res: MedusaResponse,
): Promise<void> => {
  const { paymentSessionId, cart_id, paymentData, device_session_id } = req.validatedBody;

  const { result: paymentSession } = await createMercadopagoApiPaymentWorkflow(req.scope).run({
    input: {
      paymentSessionId,
      cartId: cart_id,
      paymentData,
      customerId: req.auth_context?.actor_id,
      deviceSessionId: device_session_id,
    },
  });

  const errorMessage = (paymentSession.data as { error_message?: string } | undefined)?.error_message;
  if (errorMessage) {
    throw new MedusaError(MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR, errorMessage);
  }

  res.status(201).json({
    status: (paymentSession.data as { status?: string } | undefined)?.status ?? null,
    payment_id: (paymentSession.data as { id?: string } | undefined)?.id ?? null,
  });
};
