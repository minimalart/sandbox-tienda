import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { MERCADO_PAGO_API_PROVIDER_ID } from '../../../../modules/mercado-pago-api/constants';
import type MercadoPagoApiProviderService from '../../../../modules/mercado-pago-api/service';
import type { GetStoreMercadopagoInstallmentsParamsType } from './validators';

/**
 * Installment options with TEA/CFT data (required in Argentina by Resolución E
 * 51/2017). Proxies MercadoPago's /payment_methods/installments endpoint with
 * the collecting account's token resolved from the sales channel.
 */
export const GET = async (
  req: MedusaRequest<undefined, GetStoreMercadopagoInstallmentsParamsType>,
  res: MedusaResponse,
): Promise<void> => {
  const { payment_method_id, bin, amount, issuer_id, sales_channel_id } = req.validatedQuery;

  const provider = req.scope
    .resolve('payment')
    // @ts-expect-error — internal accessor, same pattern as the source plugin.
    .paymentProviderService_.retrieveProvider(
      MERCADO_PAGO_API_PROVIDER_ID,
    ) as MercadoPagoApiProviderService;

  const accessToken = provider.getAccount({ salesChannelId: sales_channel_id ?? null }).accessToken;

  const params = new URLSearchParams({
    payment_method_id,
    bin,
    amount: String(amount),
  });
  if (issuer_id) {
    params.append('issuer.id', String(issuer_id));
  }

  const response = await fetch(
    `https://api.mercadopago.com/v1/payment_methods/installments?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    res.status(response.status).json({
      error: 'Failed to fetch installments from MercadoPago',
      details: errorBody,
    });
    return;
  }

  const data = await response.json();
  res.status(200).json({ installments: data });
};
