import type { MedusaContainer } from '@medusajs/framework/types';
import { TYPESENSE } from '../../../modules/typesense';
import type { FacetCounts } from './engine';
import { buildAdvisorFilterBy, pendingFacetFields, type AdvisorAnswers } from './filters';

/**
 * La consulta del asesor guiado. UNA sola búsqueda por turno devuelve las tres
 * cosas que el motor necesita: cuántos productos quedan (`found`), qué valores
 * tiene cada faceta pendiente (`facets`) y los mejores candidatos por si toca
 * mostrar (`productIds`). Cero llamadas al modelo.
 */

export type AdvisorSearchResult = {
  found: number;
  facets: FacetCounts;
  productIds: string[];
  /** El `filter_by` usado, para poder loguearlo en el embudo. */
  filterBy: string;
};

/**
 * Mismo criterio de orden que la búsqueda por texto del bot: primero lo que tiene
 * stock, después el ranking comercial (§9.3). Acá no hay `_text_match` porque no
 * hay texto: el recorrido es por filtros.
 */
const ADVISOR_SORT_BY =
  '_eval(stock_available:>0):desc,metadata.ranking(missing_values: last):desc,created_at:desc';

/** Suficientes valores por faceta: las dimensiones tienen a lo sumo 5 opciones. */
const MAX_FACET_VALUES = 20;

type TypesenseLike = {
  search: (params: Record<string, unknown>) => Promise<{
    found?: number;
    hits?: Array<{ document?: { id?: string } }>;
    facet_counts?: Array<{ field_name?: string; counts?: Array<{ value?: string; count?: number }> }>;
  }>;
};

function toFacetCounts(
  raw: AdvisorSearchResult['facets'] | undefined,
  facetCounts: Array<{ field_name?: string; counts?: Array<{ value?: string; count?: number }> }>,
): FacetCounts {
  const out: FacetCounts = { ...(raw ?? {}) };
  for (const facet of facetCounts) {
    const field = facet.field_name;
    if (!field) continue;
    const values: Record<string, number> = {};
    for (const entry of facet.counts ?? []) {
      if (typeof entry.value === 'string') values[entry.value] = Number(entry.count) || 0;
    }
    out[field] = values;
  }
  return out;
}

/**
 * Corre la búsqueda del asesor. `dropped` permite reintentar sin una dimensión
 * (la relajación del §14) reusando exactamente la misma construcción de filtros.
 *
 * Devuelve `null` si Typesense no está disponible: el llamador deriva a búsqueda
 * por texto (§29), que es lo que el PRD pide como degradación.
 */
export async function runAdvisorSearch(
  container: MedusaContainer,
  opts: {
    answers: AdvisorAnswers;
    salesChannelIds: string[];
    limit: number;
    dropped?: string[];
  },
): Promise<AdvisorSearchResult | null> {
  const filterBy = buildAdvisorFilterBy(
    opts.answers,
    opts.salesChannelIds,
    (opts.dropped ?? []) as never,
  );
  const facetFields = pendingFacetFields(opts.answers);

  try {
    const ts = container.resolve(TYPESENSE) as TypesenseLike;
    const response = await ts.search({
      q: '*',
      query_by: 'title',
      filter_by: filterBy,
      facet_by: facetFields.join(','),
      max_facet_values: MAX_FACET_VALUES,
      sort_by: ADVISOR_SORT_BY,
      per_page: opts.limit,
    });
    return {
      found: Number(response?.found) || 0,
      facets: toFacetCounts(undefined, response?.facet_counts ?? []),
      productIds: (response?.hits ?? [])
        .map((h) => h?.document?.id)
        .filter((id): id is string => Boolean(id)),
      filterBy,
    };
  } catch {
    return null;
  }
}
