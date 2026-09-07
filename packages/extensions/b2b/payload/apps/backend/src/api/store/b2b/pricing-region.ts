import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

export type B2BRegion = { id?: string; currency_code: string };

/**
 * Región/moneda para la fijación de precios B2B.
 *
 * IMPORTANT: NO usar `regions[0]` — con más de una región (p.ej. una Europe/EUR
 * de prueba) puede tomar la equivocada y dejar `calculated_price` en null (el
 * catálogo mayorista mostraba precios "—" y no dejaba agregar). Debe coincidir
 * con la región del carrito (getRegion(countryCode) en el storefront).
 *
 * Para la empresa de un demo (`company.metadata.demo_id`) usa la región del demo.
 * Fallback: la primera región (comportamiento previo del wholesale global).
 */
export async function b2bPricingRegion(
  scope: { resolve: (k: string) => any },
  company: { metadata?: Record<string, unknown> | null } | null,
): Promise<B2BRegion> {
  const demoId = (company?.metadata as { demo_id?: string } | null | undefined)?.demo_id;
  if (demoId) {
    try {
      const demoService = scope.resolve('demo_store') as any;
      const demo = await demoService.retrieveDemoStore(demoId);
      if (demo?.region_id && demo?.currency_code) {
        return { id: demo.region_id, currency_code: String(demo.currency_code).toLowerCase() };
      }
    } catch {
      /* fall through to the default region */
    }
  }
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: regions } = await query.graph({ entity: 'region', fields: ['id', 'currency_code'] });
  const region = (regions ?? [])[0];
  return { id: region?.id, currency_code: region?.currency_code ?? 'ars' };
}
