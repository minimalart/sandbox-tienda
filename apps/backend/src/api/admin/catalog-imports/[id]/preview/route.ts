import { assertRowInSite } from '../../../../../lib/multistore/scope';
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { scopedConnection } from '../../../../../modules/store-importer/admin-context';
import { connectionConfigSchema } from '../../../../../modules/store-importer/config';
import {
  recoverCatalog,
  configurationDigest,
} from '../../../../../modules/store-importer/catalog-jobs';
import { catalogIdentity } from '../../../../../modules/store-importer/persist-catalog';

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { connection, site, service } = await scopedConnection(req, req.params.id!);
  assertRowInSite(connection, site, {
    kind: 'site_column',
    table: 'catalog_connection',
    column: 'destination_id',
    empty: 'unassigned',
  });
  const config = connectionConfigSchema.parse(connection.config);
  const recovered = await recoverCatalog(config, true);
  const products = [];
  for (const product of recovered.products) {
    const identity = catalogIdentity(connection.destination_id, connection.id, product.productId);
    const [record] = await service.listCatalogRecords(
      { identity, destination_id: connection.destination_id },
      { take: 1 }
    );
    const { data } = await (req.scope.resolve(ContainerRegistrationKeys.QUERY) as any).graph({
      entity: 'product',
      fields: ['id', 'metadata', 'variants.id', 'variants.metadata'],
      filters: record ? { id: record.product_id } : { handle: `catalog-${identity}` },
    });
    const previous = data[0];
    products.push({
      ...product,
      preview_action: previous
        ? 'Actualizar'
        : record
          ? 'Vínculo eliminado: requiere revisión'
          : 'Crear con identidad nueva',
      variants: (product.variants ?? [{ ...product, value: product.title }]).map((v) => {
        const prior = previous?.variants?.find(
          (p: any) => p.metadata?.external_variant_id === (v.externalVariantId ?? product.productId)
        );
        return {
          ...v,
          protected_fields: [
            ...new Set([
              ...config.protectedFields,
              ...(previous?.metadata?.catalog_protected_fields ?? []),
              ...(prior?.metadata?.catalog_protected_fields ?? []),
            ]),
          ],
        };
      }),
    });
  }
  res.json({
    ...recovered,
    products,
    configuration_digest: configurationDigest(connection, config),
    protected_fields: config.protectedFields,
    update_fields: [
      'title',
      'description',
      'images',
      'categories',
      'price',
      'listAmount',
      'presentation',
      'purchasePolicy',
    ].filter((field) => !config.protectedFields.includes(field as any)),
    note: 'Muestra sin escrituras en el catálogo. Se ejecutará la configuración revisada; los valores de origen pueden cambiar. Los productos anteriores sin vínculo externo no se fusionan automáticamente.',
  });
}
