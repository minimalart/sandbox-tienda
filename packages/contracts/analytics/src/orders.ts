/** Ask the installed order module to calculate tax-inclusive totals and discounts.
 * order_summary contains accounting balances, not shipping/tax/discount totals.
 * Batches contain only ids that have already passed the caller's scope query.
 */
export async function orderAmounts(scope: any, ids: string[]): Promise<Map<string, any>> {
  const service = scope.resolve('order');
  const unique = [...new Set(ids)],
    result = new Map<string, any>();
  for (let i = 0; i < unique.length; i += 200) {
    const rows = await service.listOrders(
      { id: unique.slice(i, i + 200) },
      {
        select: ['id', 'metadata', 'total', 'discount_total', 'shipping_total', 'tax_total'],
        take: 200,
      }
    );
    for (const row of rows) result.set(row.id, row);
  }
  if (result.size !== unique.length) throw new Error('Order totals unavailable');
  return result;
}
