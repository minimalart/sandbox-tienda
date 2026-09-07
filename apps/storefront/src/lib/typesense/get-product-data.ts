import { searchTypesenseProducts } from './products'
import type { TypesenseProductDocument } from './types'

/**
 * Fetch full product data from Typesense by product id.
 * Used on product detail pages to get discount, subtotal, price, fragrance, etc.
 * Returns null if the product is not indexed in Typesense.
 */
export async function getProductDataFromTypesense(
  productId: string,
): Promise<TypesenseProductDocument | null> {
  try {
    const { products } = await searchTypesenseProducts({
      productIds: [productId],
      limit: 1,
    })
    return products[0] ?? null
  } catch (error) {
    console.error('[getProductDataFromTypesense] Error:', error)
    return null
  }
}
