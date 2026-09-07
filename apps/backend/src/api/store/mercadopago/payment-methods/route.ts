import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { PaymentAccountHolderDTO } from '@medusajs/framework/types';
import type { GetStoreMercadopagoPaymentMethodsParamsType } from './validators';

/**
 * Lists the saved MercadoPago cards (payment methods) for the authenticated
 * customer's account holder on the given provider.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest<undefined, GetStoreMercadopagoPaymentMethodsParamsType>,
  res: MedusaResponse,
): Promise<void> => {
  const { provider_id } = req.validatedQuery;
  const paymentModuleService = req.scope.resolve(Modules.PAYMENT);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: 'customer_account_holder',
    fields: req.queryConfig.fields,
    filters: { customer_id: req.auth_context?.actor_id },
  });

  // The provider filter can't be applied on the pivot query — do it in memory.
  const [accountHolder] = data
    .filter((cah) => cah.account_holder?.provider_id === provider_id)
    .map((cah) => cah.account_holder);

  const paymentMethods = await paymentModuleService.listPaymentMethods({
    provider_id,
    context: { account_holder: accountHolder as unknown as PaymentAccountHolderDTO },
  });

  res.status(200).json({ paymentMethods });
};
