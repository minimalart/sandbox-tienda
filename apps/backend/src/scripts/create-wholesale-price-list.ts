import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import { createPriceListsWorkflow } from '@medusajs/medusa/core-flows';
import type { ExecArgs } from '@medusajs/framework/types';
import { COMPANY_MODULE } from '../modules/company';
import { CORPORATE_MODULE } from '../modules/corporate';
import { getCorporateSettings, resolveWholesaleDiscount } from '../modules/corporate/settings';

/**
 * Crea una lista de precios mayorista con TODOS los precios actuales menos 20%
 * (configurable en Corporativos → Lista mayorista, o con WHOLESALE_DISCOUNT).
 * Idempotente: si ya existe una con el mismo título, no hace nada.
 *
 *   npx medusa exec ./src/scripts/create-wholesale-price-list.ts
 *
 * La lista se ata a los customer groups mayoristas (los vinculados a empresas
 * en companies/corporates), que es lo que usa el flujo B2B para cotizar. Si no
 * hay ninguno todavía, la crea en DRAFT y avisa.
 */
export default async function createWholesalePriceList({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const pricing = container.resolve(Modules.PRICING);

  // DENTRO de la función, y antes estaban en scope de módulo. Leer configuración
  // al IMPORTAR el archivo la congela en el instante del import, y ese instante
  // no está garantizado después de que el loader de `app-settings` haya llenado
  // el snapshot: el script podía terminar corriendo con el env aunque hubiera
  // fila en la base — justo el agujero que esta migración viene a cerrar.
  const settings = getCorporateSettings();
  const DISCOUNT = resolveWholesaleDiscount(settings.wholesaleDiscount);
  const TITLE = settings.wholesalePriceListTitle;

  // 1) Customer groups mayoristas (de companies + corporates).
  const groupIds = new Set<string>();
  try {
    const companyService = container.resolve(COMPANY_MODULE) as any;
    const companies = await companyService.listCompanies({}, { select: ['customer_group_id'] });
    for (const c of companies) if (c.customer_group_id) groupIds.add(c.customer_group_id as string);
  } catch (e) {
    logger.warn(`[price-list] companies: ${(e as Error).message}`);
  }
  try {
    const corporateService = container.resolve(CORPORATE_MODULE) as any;
    const corps = await corporateService.listCorporates({}, { select: ['customer_group_id'] });
    for (const c of corps) if (c.customer_group_id) groupIds.add(c.customer_group_id as string);
  } catch (e) {
    logger.warn(`[price-list] corporates: ${(e as Error).message}`);
  }

  // 2) Moneda de la región.
  const { data: regions } = await query.graph({ entity: 'region', fields: ['id', 'currency_code'] });
  const region = regions[0] as { id: string; currency_code: string } | undefined;
  const currency = region?.currency_code ?? 'ars';

  // 3) Precio actual (base, sin grupo) de todas las variantes publicadas.
  const { data: products } = await query.graph({
    entity: 'product',
    fields: ['id', 'variants.id', 'variants.calculated_price.calculated_amount'],
    filters: { status: 'published' },
    context: {
      variants: { calculated_price: QueryContext({ currency_code: currency, region_id: region?.id }) },
    },
  });

  const prices: Array<{ variant_id: string; currency_code: string; amount: number }> = [];
  for (const p of products as Array<{ variants?: Array<{ id: string; calculated_price?: { calculated_amount?: number } }> }>) {
    for (const v of p.variants ?? []) {
      const cur = v.calculated_price?.calculated_amount;
      if (cur == null) continue;
      prices.push({
        variant_id: v.id,
        currency_code: currency,
        amount: Math.round(cur * (1 - DISCOUNT) * 100) / 100,
      });
    }
  }
  if (!prices.length) {
    logger.warn('[price-list] No hay variantes con precio; nada que crear.');
    return;
  }

  // 4) Idempotencia por título.
  const existing = await pricing
    .listPriceLists({})
    .then((l: any[]) => l.find((pl) => pl.title === TITLE))
    .catch(() => null);
  if (existing) {
    logger.warn(`[price-list] Ya existe "${TITLE}" (${existing.id}). Borrala/renombrala para recrearla. No hago cambios.`);
    return;
  }

  // 5) Crear.
  const status = groupIds.size ? 'active' : 'draft';
  await createPriceListsWorkflow(container).run({
    input: {
      price_lists_data: [
        {
          title: TITLE,
          description: `Precios mayoristas: -${Math.round(DISCOUNT * 100)}% sobre el precio actual.`,
          type: 'override',
          status,
          prices,
          ...(groupIds.size ? { rules: { 'customer.groups.id': Array.from(groupIds) } } : {}),
        } as any,
      ],
    },
  });

  logger.info(
    `[price-list] Creada "${TITLE}" (${status}) con ${prices.length} precios y ${groupIds.size} grupo(s) mayorista(s).`,
  );
  if (!groupIds.size) {
    logger.warn(
      '[price-list] Sin grupos mayoristas: quedó en DRAFT. Vinculá un customer group a una empresa (pestaña Comercial) y activá la lista / agregá la regla.',
    );
  }
}
