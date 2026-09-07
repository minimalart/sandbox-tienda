import type { HttpTypes } from '@medusajs/types'
import {
  getPaymentMethodsCatalog,
  getProductPaymentBenefits,
} from '@lib/data/payment-benefits'
import { getIndividualVariant } from '@lib/util/get-individual-variant'
import PaymentBenefitsClient from './client'

type PaymentBenefitsProps = {
  product: HttpTypes.StoreProduct
}

/**
 * Sección "Beneficios y medios de pago" de la ficha de producto. Beneficios
 * informativos (cuotas, descuentos, reintegros) traídos del backend, scopeados
 * por el sales channel activo, + "Ver todos los medios de pago". El valor de
 * cada cuota se calcula sobre el precio del producto. NUNCA modifica el precio
 * (PRD §14). Server Component: si no hay beneficios ni medios, no renderiza nada.
 */
const PaymentBenefits = async ({ product }: PaymentBenefitsProps) => {
  const categoryIds = (product.categories ?? [])
    .map((c) => c.id)
    .filter((id): id is string => Boolean(id))
  const brandId = (product as { brand?: { id?: string } }).brand?.id ?? null

  const [benefits, methods] = await Promise.all([
    getProductPaymentBenefits({
      productId: product.id,
      collectionId: product.collection_id ?? null,
      categoryIds,
      brandId,
    }),
    getPaymentMethodsCatalog(),
  ])

  if (benefits.length === 0 && methods.length === 0) return null

  // Precio de referencia para el cálculo de cuotas: variante Individual.
  const variant = getIndividualVariant(product.variants)
  const amount = variant?.calculated_price?.calculated_amount ?? undefined
  const currencyCode =
    variant?.calculated_price?.currency_code ?? 'ars'

  return (
    <PaymentBenefitsClient
      benefits={benefits}
      methods={methods}
      amount={typeof amount === 'number' ? amount : undefined}
      currencyCode={currencyCode}
    />
  )
}

export default PaymentBenefits
