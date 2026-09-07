/**
 * setup-wholesale — deja el catálogo listo para mayorista:
 *   1) suma TODOS los productos publicados al sales channel "Wholesale"
 *      (lo crea si no existe).
 *   2) crea un price list "Mayorista -20%" con el precio de cada variante a un
 *      80% del precio base (currency ARS), en estado DRAFT.
 *
 * El price list se crea en DRAFT y SIN reglas de customer group a propósito:
 * asignás los grupos (las empresas mayoristas) y lo activás desde
 * Admin → Listas de precios. Hasta entonces NO afecta a la tienda.
 *
 * Uso:
 *   DRY-RUN (solo lee y reporta):
 *     pnpm --filter @repo/backend exec medusa exec ./src/scripts/setup-wholesale.ts
 *   APLICAR:
 *     APPLY=true pnpm --filter @repo/backend exec medusa exec ./src/scripts/setup-wholesale.ts
 *
 * Variables opcionales: SC_NAME (def. "Wholesale"), CURRENCY (def. "ars"),
 *   DISCOUNT (def. "0.2"), PL_TITLE (def. "Mayorista -20%").
 */
import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import {
  createPriceListsWorkflow,
  createSalesChannelsWorkflow,
  linkProductsToSalesChannelWorkflow,
} from '@medusajs/core-flows';

const APPLY = process.env.APPLY === 'true';
const SC_NAME = process.env.SC_NAME || 'Wholesale';
const CURRENCY = (process.env.CURRENCY || 'ars').toLowerCase();
const DISCOUNT = Number(process.env.DISCOUNT || '0.2');
const PL_TITLE = process.env.PL_TITLE || 'Mayorista -20%';

type Price = { amount: number; currency_code: string; price_list_id?: string | null };
type Variant = { id: string; sku?: string | null; prices?: Price[] };
type Product = { id: string; title?: string; sales_channels?: Array<{ id: string }>; variants?: Variant[] };

export default async function setupWholesale({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const scService = container.resolve(Modules.SALES_CHANNEL);
  const offPct = Math.round(DISCOUNT * 100);

  logger.info(
    `[wholesale] modo=${APPLY ? 'APPLY' : 'DRY-RUN'} · sc="${SC_NAME}" · currency=${CURRENCY} · descuento=${offPct}%`,
  );

  // 1) Sales channel (buscar o crear)
  let [sc] = await scService.listSalesChannels({ name: SC_NAME });
  if (!sc) {
    if (APPLY) {
      const { result } = await createSalesChannelsWorkflow(container).run({
        input: { salesChannelsData: [{ name: SC_NAME }] },
      });
      sc = result[0];
      logger.info(`[wholesale] sales channel "${SC_NAME}" creado: ${sc?.id}`);
    } else {
      logger.info(`[wholesale] (dry) crearía el sales channel "${SC_NAME}".`);
    }
  }
  const scId = sc?.id as string | undefined;

  // 2) Productos publicados con variantes + precios base
  const { data: products } = (await query.graph({
    entity: 'product',
    fields: [
      'id',
      'title',
      'sales_channels.id',
      'variants.id',
      'variants.sku',
      'variants.prices.amount',
      'variants.prices.currency_code',
      'variants.prices.price_list_id',
    ],
    filters: { status: 'published' },
    pagination: { take: 10000, skip: 0 },
  })) as { data: Product[] };

  // 2a) Link a SC: solo los que todavía no están
  const toLink = scId
    ? products.filter((p) => !(p.sales_channels ?? []).some((s) => s.id === scId)).map((p) => p.id)
    : [];

  // 2b) Precios del price list = precio base ARS * (1 - DISCOUNT)
  const prices: Array<{ variant_id: string; currency_code: string; amount: number }> = [];
  let noBase = 0;
  for (const p of products) {
    for (const v of p.variants ?? []) {
      const base = (v.prices ?? []).find(
        (pr) => pr.currency_code === CURRENCY && !pr.price_list_id && Number(pr.amount) > 0,
      );
      if (!base) {
        noBase++;
        continue;
      }
      prices.push({
        variant_id: v.id,
        currency_code: CURRENCY,
        amount: Math.round(base.amount * (1 - DISCOUNT)),
      });
    }
  }

  logger.info(
    `[wholesale] productos=${products.length} · a_linkear_al_SC=${toLink.length} · precios_a_crear=${prices.length} · variantes_sin_precio_${CURRENCY}=${noBase}`,
  );

  if (!APPLY) {
    logger.info('[wholesale] DRY-RUN: no se escribió nada. Correr con APPLY=true para aplicar.');
    return;
  }

  if (scId && toLink.length) {
    await linkProductsToSalesChannelWorkflow(container).run({
      input: { id: scId, add: toLink },
    });
    logger.info(`[wholesale] ${toLink.length} productos sumados al sales channel "${SC_NAME}".`);
  }

  if (prices.length) {
    await createPriceListsWorkflow(container).run({
      input: {
        price_lists_data: [
          {
            title: PL_TITLE,
            description: `Precios mayoristas (-${offPct}%). Asigná los customer groups de las empresas y activalo desde Admin → Listas de precios.`,
            type: 'sale',
            status: 'draft',
            prices,
          },
        ] as Array<{
          title: string;
          description: string;
          type: 'sale';
          status: 'draft';
          prices: typeof prices;
        }>,
      },
    });
    logger.info(
      `[wholesale] price list "${PL_TITLE}" creado (DRAFT) con ${prices.length} precios. ` +
        'Falta: asignarle los customer groups y pasarlo a "active" en el Admin.',
    );
  }

  logger.info('[wholesale] LISTO.');
}
