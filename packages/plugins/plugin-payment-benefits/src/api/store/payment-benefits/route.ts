import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { PAYMENT_BENEFITS_MODULE } from '../../../modules/payment-benefits';
import type PaymentBenefitsModuleService from '../../../modules/payment-benefits/service';
import type { BenefitRecord } from '../../../modules/payment-benefits/service';

/** Forma pública (lean) de un beneficio para el storefront. */
function toPublic(b: BenefitRecord) {
  return {
    id: b.id,
    provider_code: b.provider_code,
    source: b.source,
    title: b.title,
    description: b.description,
    benefit_type: b.benefit_type,
    discount_type: b.discount_type,
    discount_value: b.discount_value,
    max_installments: b.max_installments,
    max_refund: b.max_refund,
    minimum_amount: b.minimum_amount,
    maximum_amount: b.maximum_amount,
    priority: b.priority,
    conditions: b.conditions,
  };
}

/**
 * Beneficios de pago aplicables y vigentes, scopeados por sales channel.
 * Con `product_id` (+ collection/category/brand) devuelve solo los que aplican
 * al producto; sin él, todos los activos del canal (para el checkout).
 * Nunca modifica el precio: es informativo (PRD §14).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<PaymentBenefitsModuleService>(PAYMENT_BENEFITS_MODULE);
  const q = req.query as Record<string, string | string[] | undefined>;

  const salesChannelId = (q.sales_channel_id as string | undefined) ?? null;
  const productId = q.product_id as string | undefined;

  let benefits: BenefitRecord[];
  if (productId) {
    const categoryIds = Array.isArray(q.category_id)
      ? (q.category_id as string[])
      : q.category_id
        ? [q.category_id as string]
        : [];
    benefits = await service.getBenefitsForProduct(productId, {
      salesChannelId,
      collectionId: (q.collection_id as string | undefined) ?? null,
      categoryIds,
      brandId: (q.brand_id as string | undefined) ?? null,
    });
  } else {
    benefits = await service.listActiveBenefits({ salesChannelId });
  }

  res.json({ payment_benefits: benefits.map(toPublic) });
}
