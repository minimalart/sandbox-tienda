import { searchTypesenseProducts } from './products'

/**
 * Fetch stock_available for a product from Typesense by product id.
 * Uses the same searchTypesenseProducts function that powers the store grid,
 * so the data path is identical to what cards use for stock badges.
 * Returns the stock_available number, or null if the product is not indexed.
 */
export async function getProductStockFromTypesense(
  productId: string,
): Promise<number | null> {
  try {
    const { products } = await searchTypesenseProducts({
      productIds: [productId],
      limit: 1,
    })
    return products[0]?.stock_available ?? null
  } catch (error) {
    console.error('[getProductStockFromTypesense] Error:', error)
    return null
  }
}
