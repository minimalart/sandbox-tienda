import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { PAYMENT_BENEFITS_MODULE } from '../../../../modules/payment-benefits';
import type PaymentBenefitsModuleService from '../../../../modules/payment-benefits/service';
import { siteFromRequest, assertRowInSite } from '../../../../lib/multistore';
import { PAYMENT_BENEFIT_SITE_SCOPE } from '../../../../modules/payment-benefits/site-scope';

const PostUpdate = z.object({
  // Siempre editables (incluso en beneficios sincronizados read-only).
  priority: z.number().int().optional(),
  hidden: z.boolean().optional(),
  sales_channel_ids: z.array(z.string()).nullable().optional(),
  admin_notes: z.string().nullable().optional(),
  status: z.enum(['draft', 'scheduled', 'active', 'expired', 'disabled', 'sync_error']).optional(),
  // Oficiales (solo se aplican si el beneficio es manual; el servicio los ignora en read-only).
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  benefit_type: z.enum(['installments', 'percentage_discount', 'fixed_discount', 'refund', 'cashback', 'custom']).optional(),
  discount_type: z.string().nullable().optional(),
  discount_value: z.number().nullable().optional(),
  max_installments: z.number().int().nullable().optional(),
  interest_rate: z.number().nullable().optional(),
  max_refund: z.number().nullable().optional(),
  minimum_amount: z.number().nullable().optional(),
  maximum_amount: z.number().nullable().optional(),
  valid_from: z.string().nullable().optional(),
  valid_to: z.string().nullable().optional(),
  eligibility: z
    .object({ scope: z.enum(['global', 'collection', 'category', 'brand', 'product']), ids: z.array(z.string()) })
    .nullable()
    .optional(),
  conditions: z.record(z.string(), z.string().nullable()).nullable().optional(),
});

/** Detalle de un beneficio. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<PaymentBenefitsModuleService>(PAYMENT_BENEFITS_MODULE);
  const benefit = await service.retrievePaymentBenefit(req.params.id as string);
  assertRowInSite(benefit as Record<string, unknown>, await siteFromRequest(req), PAYMENT_BENEFIT_SITE_SCOPE);
  res.json({ payment_benefit: benefit });
}

/** Edita un beneficio (respeta el guard read-only del servicio). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PostUpdate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const service = req.scope.resolve<PaymentBenefitsModuleService>(PAYMENT_BENEFITS_MODULE);
  assertRowInSite(
    (await service.retrievePaymentBenefit(req.params.id as string)) as Record<string, unknown>,
    await siteFromRequest(req),
    PAYMENT_BENEFIT_SITE_SCOPE,
  );

  const benefit = await service.updateBenefit(req.params.id as string, parsed.data as never);
  res.json({ payment_benefit: benefit });
}

/** Elimina un beneficio (soft-delete). */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<PaymentBenefitsModuleService>(PAYMENT_BENEFITS_MODULE);
  assertRowInSite(
    (await service.retrievePaymentBenefit(req.params.id as string)) as Record<string, unknown>,
    await siteFromRequest(req),
    PAYMENT_BENEFIT_SITE_SCOPE,
  );

  await service.deletePaymentBenefits(req.params.id as string);
  res.json({ id: req.params.id, object: 'payment_benefit', deleted: true });
}
