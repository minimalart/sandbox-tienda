import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { MedusaError, Modules } from '@medusajs/framework/utils';
import type { PaymentSessionDTO } from '@medusajs/framework/types';
import { MERCADO_PAGO_API_PROVIDER_ID } from '../../constants';
import type MercadoPagoApiProviderService from '../../service';
import type { PostStoreMercadopagoPaymentType } from '../../../../api/store/mercadopago/payment/validators';
import { resolveSite } from '../../../../lib/multistore/resolve-site';

type CreatePaymentStepInput = {
  paymentSessionId: string;
  paymentData: PostStoreMercadopagoPaymentType['paymentData'];
  deviceSessionId?: string;
  cartId: string;
  salesChannelId?: string | null;
};

/**
 * Creates the payment in MercadoPago via the Checkout API provider and stores
 * the MP payment object on the Medusa payment session so the webhook can later
 * authorize/capture it.
 */
export const createMercadopagoApiPaymentStep = createStep<
  CreatePaymentStepInput,
  PaymentSessionDTO,
  undefined
>(
  'create-mercadopago-api-payment',
  async ({ paymentSessionId, paymentData, deviceSessionId, cartId, salesChannelId }, { container }) => {
    const provider = container
      .resolve('payment')
      // @ts-expect-error — internal accessor, same pattern as the source plugin.
      .paymentProviderService_.retrieveProvider(
        MERCADO_PAGO_API_PROVIDER_ID,
      ) as MercadoPagoApiProviderService;
    const paymentModule = container.resolve(Modules.PAYMENT);

    const paymentSession = await paymentModule.retrievePaymentSession(paymentSessionId, {
      select: ['amount', 'currency_code'],
    });
    if (!paymentSession) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Payment session with id ${paymentSessionId} was not found`,
      );
    }

    /**
     * La tienda se deriva ACÁ y no en el provider: este step corre con el container
     * completo del workflow, mientras que el provider recibe uno aislado y no puede
     * resolverla. Además `getAccount` es síncrono y está sobre el camino del cobro —
     * no es lugar para una consulta.
     *
     * Si el canal no pertenece a ninguna tienda, queda `null` y se cobra con la
     * cuenta global, que es exactamente el comportamiento actual.
     */
    const resolution = await resolveSite(container, { salesChannelId: salesChannelId ?? null });
    const site = resolution.status === 'site' ? resolution.site : null;

    const paymentResponse = await provider.createPayment({
      paymentSessionId,
      payload: paymentData,
      deviceSessionId,
      cartId,
      salesChannelId,
      siteId: site?.id ?? null,
      siteSlug: site?.slug ?? null,
    });

    const updatedSession = await paymentModule.updatePaymentSession({
      id: paymentSessionId,
      amount: paymentSession.amount,
      currency_code: paymentSession.currency_code,
      data: paymentResponse as unknown as Record<string, unknown>,
    });
    return new StepResponse(updatedSession);
  },
);
