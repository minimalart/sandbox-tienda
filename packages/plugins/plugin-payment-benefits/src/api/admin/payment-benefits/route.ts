import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { PAYMENT_BENEFITS_MODULE } from '../../../modules/payment-benefits';
import { siteFromRequest, siteFilter, siteDefaults } from '../../../lib/multistore';
import { PAYMENT_BENEFIT_SITE_SCOPE } from '../../../modules/payment-benefits/site-scope';
import type PaymentBenefitsModuleService from '../../../modules/payment-benefits/service';

const BENEFIT_TYPES = [
  'installments', 'percentage_discount', 'fixed_discount', 'refund', 'cashback', 'custom',
] as const;

const EligibilitySchema = z.object({
  scope: z.enum(['global', 'collection', 'category', 'brand', 'product']),
  ids: z.array(z.string()).default([]),
});

const PostCreate = z.object({
  title: z.string().min(1),
  benefit_type: z.enum(BENEFIT_TYPES),
  provider_code: z.string().optional(),
  description: z.string().nullable().optional(),
  discount_type: z.string().nullable().optional(),
  discount_value: z.number().nullable().optional(),
  max_installments: z.number().int().nullable().optional(),
  interest_rate: z.number().nullable().optional(),
  max_refund: z.number().nullable().optional(),
  minimum_amount: z.number().nullable().optional(),
  maximum_amount: z.number().nullable().optional(),
  status: z.enum(['draft', 'scheduled', 'active', 'expired', 'disabled', 'sync_error']).optional(),
  priority: z.number().int().optional(),
  valid_from: z.string().nullable().optional(),
  valid_to: z.string().nullable().optional(),
  eligibility: EligibilitySchema.nullable().optional(),
  conditions: z.record(z.string(), z.string().nullable()).nullable().optional(),
  sales_channel_ids: z.array(z.string()).nullable().optional(),
  admin_notes: z.string().nullable().optional(),
  hidden: z.boolean().optional(),
});

/** Listado de beneficios con filtros (provider/status/type/source). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<PaymentBenefitsModuleService>(PAYMENT_BENEFITS_MODULE);
  const q = req.query as Record<string, string | undefined>;

  const filters: Record<string, unknown> = {};
  if (q.provider_code) filters.provider_code = q.provider_code;
  if (q.status) filters.status = q.status;
  if (q.benefit_type) filters.benefit_type = q.benefit_type;
  if (q.source) filters.source = q.source;

  // Sin tienda activa devuelve {} y el listado no cambia.
  Object.assign(filters, await siteFilter(req.scope, await siteFromRequest(req), PAYMENT_BENEFIT_SITE_SCOPE));

  const limit = q.limit ? Number(q.limit) : 50;
  const offset = q.offset ? Number(q.offset) : 0;

  const [benefits, count] = await service.listAndCountPaymentBenefits(filters, {
    order: { priority: 'DESC', created_at: 'DESC' },
    take: limit,
    skip: offset,
  });

  res.json({ payment_benefits: benefits, count, limit, offset });
}

/** Crea un beneficio manual. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PostCreate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const service = req.scope.resolve<PaymentBenefitsModuleService>(PAYMENT_BENEFITS_MODULE);

  // Nace en la tienda activa salvo que el cuerpo declare canales explícitamente.
  const defaults =
    (parsed.data as { sales_channel_ids?: unknown }).sales_channel_ids === undefined
      ? siteDefaults(await siteFromRequest(req), PAYMENT_BENEFIT_SITE_SCOPE)
      : {};

  const benefit = await service.createManualBenefit({ ...parsed.data, ...defaults } as never);
  res.json({ payment_benefit: benefit });
}
