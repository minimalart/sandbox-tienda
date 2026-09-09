/** Provider-independent, additive metadata. Quantities always count the selected SKU. */
export type Presentation = {
  label?: string;
  mode: 'informational' | 'grouping' | 'own-sku';
  unitsPerPackage?: number;
  priceBasis?: 'unit' | 'sku';
};
export type PurchasePolicy = {
  enabled: boolean;
  minQuantity?: number;
  quantityStep?: number;
  allowedModes?: Array<'unit' | 'package'>;
};
export type CatalogCommercial = {
  inventoryMode?: 'ignore' | 'availability-only';
  version: 1;
  currencyCode: string;
  priceTaxIncluded?: boolean;
  amount: number;
  listAmount?: number;
  sourceAmount?: number;
  sourceListAmount?: number;
  sellerRef?: string;
  contextRef?: string;
  observedAt: string;
  measurementUnit?: string;
  unitMultiplier?: number;
  presentation?: Presentation;
  purchasePolicy?: PurchasePolicy;
  availability?: { status: 'available' | 'unavailable' | 'unknown'; quantity?: number };
  rawPresentation?: string;
  mappingVersion?: string;
  warnings?: string[];
};

export function canonicalQuantity(
  quantity: number,
  mode: 'unit' | 'package',
  commercial?: CatalogCommercial
): number {
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new Error('Ingresá una cantidad entera positiva.');
  const policy = commercial?.purchasePolicy;
  const presentation = commercial?.presentation;
  let canonical = quantity;
  if (mode === 'package') {
    if (!policy?.enabled || !policy.allowedModes?.includes('package'))
      throw new Error('La compra por presentación no está habilitada.');
    if (presentation?.mode === 'grouping') {
      const factor = presentation.unitsPerPackage;
      if (presentation.priceBasis !== 'unit' || !Number.isSafeInteger(factor) || factor! < 1)
        throw new Error('La equivalencia o la base de precio no está confirmada.');
      canonical *= factor!;
    } else if (presentation?.mode !== 'own-sku' || presentation.priceBasis !== 'sku') {
      throw new Error('Esta presentación es informativa y no permite convertir cantidades.');
    }
  } else if (policy?.enabled && policy.allowedModes && !policy.allowedModes.includes('unit')) {
    throw new Error('Seleccioná una presentación habilitada.');
  }
  if (!Number.isSafeInteger(canonical)) throw new Error('La cantidad supera el límite permitido.');
  validateCanonicalQuantity(canonical, commercial);
  return canonical;
}

export function validateCanonicalQuantity(quantity: number, commercial?: CatalogCommercial): void {
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new Error('Ingresá una cantidad entera positiva.');
  if (
    commercial?.inventoryMode === 'availability-only' &&
    commercial.availability?.status === 'unavailable'
  )
    throw new Error('Esta presentación no está disponible en el origen.');
  const policy = commercial?.purchasePolicy;
  if (!policy?.enabled) return;
  const min = policy.minQuantity ?? 1;
  const step = policy.quantityStep ?? 1;
  if (!Number.isSafeInteger(min) || min < 1 || !Number.isSafeInteger(step) || step < 1)
    throw new Error('La política de cantidades necesita corrección.');
  if (quantity < min || quantity % step !== 0)
    throw new Error(`La cantidad mínima es ${min} y debe ser múltiplo de ${step}.`);
}

export function referenceAmount(
  commercial: CatalogCommercial | undefined,
  amount: number,
  currency: string,
  priceTaxIncluded?: boolean
): number | undefined {
  const list = commercial?.listAmount;
  return commercial?.currencyCode === currency.toLowerCase() &&
    typeof commercial.priceTaxIncluded === 'boolean' &&
    commercial.priceTaxIncluded === priceTaxIncluded &&
    Number.isFinite(list) &&
    list! > amount
    ? list
    : undefined;
}
