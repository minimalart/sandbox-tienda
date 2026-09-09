export type CatalogCommercial = {
  version: 1;
  currencyCode: string;
  priceTaxIncluded?: boolean;
  amount: number;
  listAmount?: number;
  measurementUnit?: string;
  unitMultiplier?: number;
  presentation?: {
    label?: string;
    mode: 'informational' | 'grouping' | 'own-sku';
    unitsPerPackage?: number;
    priceBasis?: 'unit' | 'sku';
  };
  purchasePolicy?: {
    enabled: boolean;
    minQuantity?: number;
    quantityStep?: number;
    allowedModes?: Array<'unit' | 'package'>;
  };
};
export function presentationFactor(c?: CatalogCommercial): number {
  const p = c?.presentation;
  if (!c?.purchasePolicy?.enabled || !c.purchasePolicy.allowedModes?.includes('package')) return 1;
  return p?.mode === 'grouping' &&
    p.priceBasis === 'unit' &&
    Number.isSafeInteger(p.unitsPerPackage) &&
    p.unitsPerPackage! > 0
    ? p.unitsPerPackage!
    : 1;
}
export function presentationSummary(metadata: any, quantity: number): string | null {
  const p = metadata?.catalog_presentation;
  if (!p) return null;
  if (
    p.mode === 'grouping' &&
    Number.isSafeInteger(p.unitsPerPackage) &&
    p.unitsPerPackage > 0 &&
    quantity % p.unitsPerPackage === 0
  )
    return `${quantity / p.unitsPerPackage} ${p.label || 'bultos'} × ${p.unitsPerPackage} = ${quantity} unidades`;
  return `${quantity} ${p.label || 'presentaciones'}${p.unitsPerPackage ? ` · ${p.unitsPerPackage} unidades por presentación` : ''}`;
}
export function catalogListAmount(variant: any): number | undefined {
  const commercial = variant?.metadata?.catalog_commercial as CatalogCommercial | undefined;
  const current = variant?.calculated_price;
  const list = commercial?.listAmount;
  return typeof commercial?.priceTaxIncluded === 'boolean' &&
    commercial.priceTaxIncluded === current?.is_calculated_price_tax_inclusive &&
    commercial.currencyCode === current?.currency_code &&
    Number.isFinite(list) &&
    list! > current.calculated_amount
    ? list
    : undefined;
}
