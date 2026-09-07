'use server';

import 'server-only';

import { getTenant } from '@lib/site-config/resolver';
import { getActiveDemoSalesChannelId } from '@lib/site-config/active-tenant';

export type PublicPaymentBenefit = {
  id: string;
  provider_code: string;
  source: string;
  title: string;
  description: string | null;
  benefit_type: string;
  discount_type: string | null;
  discount_value: number | null;
  max_installments: number | null;
  max_refund: number | null;
  minimum_amount: number | null;
  maximum_amount: number | null;
  priority: number;
  conditions: Record<string, string | null> | null;
};

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000';
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';

export type PaymentMethodOption = {
  external_id: string;
  name: string;
  payment_type_id: string | null;
  thumbnail_url: string | null;
  max_interest_free_installments: number | null;
};

type ProductScope = {
  productId: string;
  collectionId?: string | null;
  categoryIds?: string[];
  brandId?: string | null;
};

/**
 * Beneficios de pago aplicables a un producto, scopeados por el sales channel
 * activo (contexto demo → canal de la demo; si no, el canal del tenant). Solo
 * lectura, best-effort: ante cualquier error devuelve []. Nunca toca el precio.
 */
export async function getProductPaymentBenefits(
  scope: ProductScope,
): Promise<PublicPaymentBenefit[]> {
  try {
    // Canal: demo primero, luego el del tenant. El backend interpreta "sin
    // canales asignados" como global, así que siempre mandamos el resuelto.
    const demoChannel = await getActiveDemoSalesChannelId();
    let salesChannelId = demoChannel;
    if (!salesChannelId) {
      const tenant = await getTenant();
      salesChannelId = tenant.medusa.salesChannelId ?? null;
    }

    const params = new URLSearchParams();
    params.set('product_id', scope.productId);
    if (scope.collectionId) params.set('collection_id', scope.collectionId);
    if (scope.brandId) params.set('brand_id', scope.brandId);
    for (const cat of scope.categoryIds ?? []) params.append('category_id', cat);
    if (salesChannelId) params.set('sales_channel_id', salesChannelId);

    const response = await fetch(
      `${BACKEND_URL}/store/payment-benefits?${params.toString()}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(PUBLISHABLE_KEY ? { 'x-publishable-api-key': PUBLISHABLE_KEY } : {}),
        },
        next: { revalidate: 60 },
      },
    );
    if (!response.ok) return [];
    const data = (await response.json()) as { payment_benefits?: PublicPaymentBenefit[] };
    return (data.payment_benefits ?? []).sort((a, b) => b.priority - a.priority);
  } catch {
    return [];
  }
}

/**
 * Catálogo completo de medios de pago (con logos) para el modal "Ver todos los
 * medios de pago". Incluye los que no tienen cuotas. Best-effort → [].
 */
export async function getPaymentMethodsCatalog(): Promise<PaymentMethodOption[]> {
  try {
    const response = await fetch(`${BACKEND_URL}/store/payment-methods`, {
      headers: {
        'Content-Type': 'application/json',
        ...(PUBLISHABLE_KEY ? { 'x-publishable-api-key': PUBLISHABLE_KEY } : {}),
      },
      next: { revalidate: 300 },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { payment_methods?: PaymentMethodOption[] };
    return data.payment_methods ?? [];
  } catch {
    return [];
  }
}
