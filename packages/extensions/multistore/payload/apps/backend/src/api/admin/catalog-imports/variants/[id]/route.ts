import { assertRowInSite } from '../../../../../lib/multistore/scope';
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules, MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';
import { catalogAdminContext } from '../../../../../modules/store-importer/admin-context';
import {
  presentationSchema,
  purchasePolicySchema,
} from '../../../../../modules/store-importer/config';
import { canonicalQuantity } from '../../../../../lib/catalog/commercial';

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { destinationId, site } = await catalogAdminContext(req);
  const { data } = await (req.scope.resolve(ContainerRegistrationKeys.QUERY) as any).graph({
    entity: 'product_variant',
    fields: ['id', 'metadata', 'product.metadata'],
    filters: { id: req.params.id },
  });
  const variant = data[0];
  if (variant?.product?.metadata?.catalog_destination_id !== destinationId)
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'SKU no encontrado en este destino.');
  assertRowInSite(variant.product.metadata, site, {
    kind: 'site_column',
    table: 'product',
    column: 'catalog_destination_id',
    empty: 'unassigned',
  });
  const parsed = z
    .object({
      listAmount: z.number().finite().nonnegative().nullable().optional(),
      presentation: presentationSchema.optional(),
      purchasePolicy: purchasePolicySchema.optional(),
      restore: z.array(z.enum(['listAmount', 'presentation', 'purchasePolicy'])).default([]),
    })
    .strict()
    .safeParse(req.body);
  if (!parsed.success)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Revisá la lista, la equivalencia y la política de cantidades.'
    );
  const metadata = { ...variant.metadata };
  const commercial = { ...metadata.catalog_commercial };
  const protectedFields = new Set<string>(metadata.catalog_protected_fields ?? []);
  for (const field of ['listAmount', 'presentation', 'purchasePolicy'] as const) {
    if (parsed.data.restore.includes(field)) {
      commercial[field] = metadata.catalog_source?.[field];
      protectedFields.delete(field);
    } else if (Object.prototype.hasOwnProperty.call(parsed.data, field)) {
      commercial[field] = parsed.data[field];
      protectedFields.add(field);
    }
  }
  if (
    commercial.purchasePolicy?.enabled &&
    commercial.purchasePolicy?.allowedModes?.includes('package')
  ) {
    try {
      canonicalQuantity(
        commercial.purchasePolicy.minQuantity ?? commercial.purchasePolicy.quantityStep ?? 1,
        'package',
        commercial
      );
    } catch (error) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, (error as Error).message);
    }
  }
  metadata.catalog_commercial = commercial;
  metadata.catalog_protected_fields = [...protectedFields];
  await (req.scope.resolve(Modules.PRODUCT) as any).updateProductVariants({
    id: variant.id,
    metadata,
  });
  res.json({ variant: { id: variant.id, metadata } });
}
