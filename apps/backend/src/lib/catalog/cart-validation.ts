import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { canonicalQuantity, validateCanonicalQuantity, type CatalogCommercial } from './commercial';

/**
 * `connections` memoiza la conexión por id dentro de una misma validación: un
 * carrito con N SKUs del mismo catálogo la leía N veces en serie.
 */
export async function effectiveCommercial(
  container: any,
  variant: any,
  connections?: Map<string, Promise<any>>
): Promise<CatalogCommercial | undefined> {
  const stored = variant.metadata?.catalog_commercial;
  if (!stored) return undefined;
  const commercial: CatalogCommercial = {
    ...stored,
    presentation: stored.presentation ? { ...stored.presentation } : undefined,
    purchasePolicy: stored.purchasePolicy ? { ...stored.purchasePolicy } : undefined,
  };
  const connectionId = variant.product?.metadata?.catalog_connection_id;
  if (!connectionId) return commercial;
  let service: any;
  try {
    service = container.resolve('catalog_import');
  } catch {
    return { ...commercial, purchasePolicy: { enabled: false } };
  }
  let pending = connections?.get(connectionId);
  if (!pending) {
    pending = service.retrieveCatalogConnection(connectionId).catch(() => null);
    connections?.set(connectionId, pending!);
  }
  const connection = await pending;
  if (!connection?.enabled) return { ...commercial, purchasePolicy: { enabled: false } };
  const protectedFields = new Set([
    ...(connection.config.protectedFields ?? []),
    ...(variant.product?.metadata?.catalog_protected_fields ?? []),
    ...(variant.metadata?.catalog_protected_fields ?? []),
  ]);
  if (!protectedFields.has('purchasePolicy'))
    commercial.purchasePolicy = connection.config.purchasePolicy;
  if (!protectedFields.has('presentation') && connection.config.presentation) {
    // Connection-level fixed corrections take effect immediately; mapping-derived values stay SKU-specific.
    commercial.presentation = { ...commercial.presentation, ...connection.config.presentation };
  }
  return commercial;
}

export async function validateCatalogLines(container: any, items: any[]) {
  const variantIds = [...new Set<string>(items.map((i) => i.variant_id).filter(Boolean))];
  if (!variantIds.length) return;
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'product_variant',
    fields: ['id', 'metadata', 'product.metadata'],
    filters: { id: variantIds },
  });
  const connections = new Map<string, Promise<any>>();
  for (const item of items) {
    const variant = data.find((v: any) => v.id === item.variant_id);
    if (!variant?.metadata?.catalog_commercial) continue;
    const commercial = await effectiveCommercial(container, variant, connections);
    try {
      validateCanonicalQuantity(Number(item.quantity), commercial);
      const snapshot = item.metadata?.catalog_presentation;
      if (snapshot) {
        if (snapshot.variant_id !== item.variant_id)
          throw new Error('La presentación no corresponde al SKU.');
        const current = commercial?.presentation;
        if (
          current?.mode !== snapshot.mode ||
          current?.priceBasis !== snapshot.priceBasis ||
          current?.unitsPerPackage !== snapshot.unitsPerPackage
        )
          throw new Error(
            'La presentación cambió. Revisá la cantidad y volvé a agregar el producto.'
          );
        if (snapshot.mode === 'grouping' && item.quantity % snapshot.unitsPerPackage !== 0)
          throw new Error('La cantidad no corresponde a bultos completos.');
      } else if (
        commercial?.purchasePolicy?.enabled &&
        commercial.purchasePolicy.allowedModes &&
        !commercial.purchasePolicy.allowedModes.includes('unit')
      ) {
        throw new Error('Este SKU requiere seleccionar una presentación.');
      }
    } catch (error) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, (error as Error).message);
    }
  }
}

export function presentationLine(
  variant: any,
  quantity: number,
  mode: 'unit' | 'package',
  commercial?: CatalogCommercial
) {
  const canonical = canonicalQuantity(quantity, mode, commercial);
  return {
    variant_id: variant.id,
    quantity: canonical,
    metadata:
      mode === 'package'
        ? {
            catalog_presentation: {
              ...commercial!.presentation,
              variant_id: variant.id,
              version: 1,
            },
          }
        : {},
  };
}
