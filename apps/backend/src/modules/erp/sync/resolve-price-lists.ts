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

type PriceListRow = { id: string; title: string };

export type ResolvedPriceLists = {
  targets: PriceListTarget[];
  /** Avisos no fatales (lista sin customer group, etc.) para el summary del log. */
  warnings: string[];
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
  if (!enabled.length) return { targets, warnings };

  const existing = await pricing.listPriceLists({}, { take: null });
  const byTitle = new Map<string, PriceListRow>();
  for (const list of existing) {
    // La primera gana: si hay títulos duplicados se avisa y se usa la más vieja
    // en lugar de crear una tercera.
    if (list.title && !byTitle.has(list.title)) byTitle.set(list.title, list);
  }

  for (const mapping of enabled) {
    const title = mapping.title?.trim();
    if (!title) {
      warnings.push(`La lista del ERP ${mapping.zeus_index} no tiene título configurado; se ignora.`);
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
  }

  return { targets, warnings };
}
