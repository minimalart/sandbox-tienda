import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { createPriceListsWorkflow } from '@medusajs/medusa/core-flows';
import type { ErpPriceListMapping } from '../types';
import type { PriceListTarget } from './plan-price-updates';

/**
 * Resuelve (buscando por título, creando si falta) las price lists de Medusa a
 * las que el catalog sync escribe.
 *
 * IMPORTANTE: acá NO se usa el patrón "borrar por título y recrear" que aplican
 * `scripts/create-wholesale-price-list.ts` y `modules/demo-store/b2b-pricing.ts`.
 * Eso está bien para un seed de una vez, pero en un cron cada 15 minutos
 * destruiría todos los precios en cada corrida (y con ellos los ids que el diff
 * incremental necesita para hacer update en lugar de insert).
 *
 * Las listas se crean vacías: los precios los carga el motor de sync con el
 * diff, no este archivo.
 */

type PriceListRow = {
  id: string;
  title: string;
  status?: string | null;
  type?: string | null;
  rules?: Record<string, unknown> | null;
};

export type ResolvedPriceLists = {
  targets: PriceListTarget[];
  /** Avisos no fatales (lista sin customer group, etc.) para el summary del log. */
  warnings: string[];
  /**
   * TODAS las price lists de Medusa al momento de resolver, no sólo las
   * mapeadas. Es lo que necesita `detect-overriding-price-lists.ts` para ver si
   * hay una lista ajena tapándole el precio base al ERP — el caso "Ecommerce"
   * de desdeelsur, que costó un mes de ventas al 70%.
   */
  allPriceLists: Array<{
    id: string;
    title: string | null;
    status: string | null;
    type: string | null;
    rules?: Record<string, unknown> | null;
  }>;
};

export async function resolvePriceLists(
  container: MedusaContainer,
  mappings: ErpPriceListMapping[]
): Promise<ResolvedPriceLists> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const pricing = container.resolve(Modules.PRICING) as {
    listPriceLists(filters: Record<string, unknown>, config?: unknown): Promise<PriceListRow[]>;
  };

  const enabled = mappings.filter((mapping) => mapping.enabled !== false);
  const targets: PriceListTarget[] = [];
  const warnings: string[] = [];

  // El listado se pide SIEMPRE, incluso sin mapeos: una price list ajena que
  // pisa el precio base es un problema independiente de si el cliente mapeó
  // alguna lista del ERP (en desdeelsur el mapeo existía y el problema era otra
  // lista). Sin esto, salir temprano se llevaba puesta la detección.
  const existing = await pricing.listPriceLists({}, { take: null });
  const allPriceLists = existing.map((list) => ({
    id: list.id,
    title: list.title ?? null,
    status: list.status ?? null,
    type: list.type ?? null,
    rules: list.rules ?? null,
  }));
  if (!enabled.length) return { targets, warnings, allPriceLists };
  const byTitle = new Map<string, PriceListRow>();
  for (const list of existing) {
    // La primera gana: si hay títulos duplicados se avisa y se usa la más vieja
    // en lugar de crear una tercera.
    if (list.title && !byTitle.has(list.title)) byTitle.set(list.title, list);
  }

  for (const mapping of enabled) {
    const title = mapping.title?.trim();
    if (!title) {
      warnings.push(
        `La lista del ERP ${mapping.zeus_index} no tiene título configurado; se ignora.`
      );
      continue;
    }

    const found = byTitle.get(title);
    if (found) {
      targets.push({ zeus_index: mapping.zeus_index, price_list_id: found.id, title });
      continue;
    }

    // Sin customer group la lista se crea en `draft`: activarla sin regla la
    // aplicaría a TODOS los clientes, que nunca es lo que se quiere de una
    // lista mayorista.
    if (!mapping.customer_group_id) {
      warnings.push(
        `Se creó la price list "${title}" en estado draft porque no tiene customer group configurado; ` +
          'asignale uno desde el admin para que aplique.'
      );
    }

    const { result } = await createPriceListsWorkflow(container).run({
      input: {
        price_lists_data: [
          {
            title,
            description: `Sincronizada desde el ERP (lista ${mapping.zeus_index}).`,
            type: 'override',
            status: mapping.customer_group_id ? 'active' : 'draft',
            prices: [],
            ...(mapping.customer_group_id
              ? { rules: { 'customer.groups.id': [mapping.customer_group_id] } }
              : {}),
          } as never,
        ],
      },
    });

    const created = (result as PriceListRow[] | undefined)?.[0];
    if (!created?.id) {
      warnings.push(`No se pudo crear la price list "${title}"; esa lista queda sin sincronizar.`);
      continue;
    }
    logger.info(`[erp] catalog sync: price list "${title}" creada (${created.id}).`);
    targets.push({ zeus_index: mapping.zeus_index, price_list_id: created.id, title });
    // La recién creada entra al snapshot para que el aviso de "quedó en draft"
    // se siga emitiendo en las corridas siguientes, no sólo en la que la creó.
    allPriceLists.push({
      id: created.id,
      title,
      status: mapping.customer_group_id ? 'active' : 'draft',
      type: 'override',
      rules: mapping.customer_group_id
        ? { 'customer.groups.id': [mapping.customer_group_id] }
        : null,
    });
  }

  return { targets, warnings, allPriceLists };
}
