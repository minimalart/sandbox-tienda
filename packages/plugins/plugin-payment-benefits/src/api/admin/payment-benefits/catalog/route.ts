import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { PAYMENT_BENEFITS_MODULE } from '../../../../modules/payment-benefits';
import type PaymentBenefitsModuleService from '../../../../modules/payment-benefits/service';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { PAYMENT_METHOD_CATALOG_SITE_SCOPE } from '../../../../modules/payment-benefits/site-scope';

/** Catálogo crudo de medios de pago sincronizado del proveedor. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<PaymentBenefitsModuleService>(PAYMENT_BENEFITS_MODULE);
  const q = req.query as Record<string, string | undefined>;
  const filters: Record<string, unknown> = {};
  if (q.provider_code) filters.provider_code = q.provider_code;

  // El catálogo sigue a la cuenta del proveedor, que ya es por tienda.
  Object.assign(
    filters,
    await siteFilter(req.scope, await siteFromRequest(req), PAYMENT_METHOD_CATALOG_SITE_SCOPE),
  );

  const methods = await service.listPaymentMethodCatalogs(filters, {
    order: { payment_type_id: 'ASC', name: 'ASC' },
    take: 500,
  });
  res.json({ payment_methods: methods });
}
