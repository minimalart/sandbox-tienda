import type { ProductImporter } from '../../demo-store/catalog/types';
import { vtexImporter } from './vtex';
import { wooCommerceImporter } from './woocommerce';
import { shopifyImporter } from './shopify';

export * from '../../demo-store/catalog/types';

/**
 * `SourceType`, `PlatformSourceType` e `isSalesChannelSource` viven en
 * `../source-type.ts`, no acá: las rutas de `multistore` los necesitan y el paquete
 * `store-importer` es opcional. Se re-exportan para no romper a quien los importaba
 * desde el importador.
 */
export type { SourceType, PlatformSourceType } from '../../demo-store/source-type';
export { isSalesChannelSource } from '../../demo-store/source-type';

import { isSalesChannelSource } from '../../demo-store/source-type';
import type { PlatformSourceType, SourceType } from '../../demo-store/source-type';

const IMPORTERS: Record<PlatformSourceType, ProductImporter> = {
  woocommerce: wooCommerceImporter,
  vtex: vtexImporter,
  shopify: shopifyImporter,
};

/** Resolve the importer strategy for a demo's source type. */
export function getImporter(sourceType: SourceType): ProductImporter {
  if (isSalesChannelSource(sourceType)) {
    throw new Error(
      'El origen "sales_channel" no usa un importer: los productos se vinculan desde el canal existente.'
    );
  }
  const importer = IMPORTERS[sourceType as PlatformSourceType];
  if (!importer) throw new Error(`Unknown demo store source type: ${sourceType}`);
  return importer;
}
