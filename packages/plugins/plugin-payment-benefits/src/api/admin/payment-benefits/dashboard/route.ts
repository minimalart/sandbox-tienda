import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { PAYMENT_BENEFIT_SITE_SCOPE } from '../../../../modules/payment-benefits/site-scope';
import { PAYMENT_BENEFITS_MODULE } from '../../../../modules/payment-benefits';
import type PaymentBenefitsModuleService from '../../../../modules/payment-benefits/service';
import { PROVIDERS } from '../../../../modules/payment-benefits/providers';

/** Métricas del dashboard + proveedores disponibles (PRD §11). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<PaymentBenefitsModuleService>(PAYMENT_BENEFITS_MODULE);
  const dashboard = await service.getDashboard(
    await siteFilter(req.scope, await siteFromRequest(req), PAYMENT_BENEFIT_SITE_SCOPE),
  );
  const providers = Object.values(PROVIDERS).map((p) => ({
    code: p.code,
    supports_sync: p.supportsSync,
  }));
  res.json({ ...dashboard, providers });
}
