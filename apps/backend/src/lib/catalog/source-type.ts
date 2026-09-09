/**
 * De dónde viene el catálogo de una tienda.
 *
 * Vive acá y no en `importers/index.ts` para que el paquete `store-importer` pueda
 * ser OPCIONAL: `api/admin/sites/route.ts` y `[id]/retry` necesitan clasificar el
 * origen, pero no necesitan ningún importador. Con la clasificación adentro del
 * importador, sacarlo dejaba esas rutas con imports colgados — y eso no lo atrapa
 * `assertRelativeImportsResolve`, que sólo valida `apps/backend/src/admin`: fallaría
 * recién en el `tsc` del proyecto del cliente.
 *
 * Los tres primeros son plataformas EXTERNAS que se leen por sus endpoints públicos
 * y se normalizan. `sales_channel` es distinto en especie: el catálogo ya vive en
 * esta instancia de Medusa, así que no hay nada que traer — la tienda ADOPTA ese
 * canal y el "import" sólo mide el catálogo.
 */
export type SourceType = 'woocommerce' | 'vtex' | 'shopify' | 'sales_channel';

/** Los orígenes que sí se traen de una plataforma externa con un `ProductImporter`. */
export type PlatformSourceType = Exclude<SourceType, 'sales_channel'>;

/** Si este origen adopta un canal existente en vez de leer una plataforma externa. */
export function isSalesChannelSource(sourceType: SourceType): boolean {
  return sourceType === 'sales_channel';
}
