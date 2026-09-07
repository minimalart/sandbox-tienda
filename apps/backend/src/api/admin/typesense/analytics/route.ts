import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import TypeSenseService from '../../../../modules/typesense/service';

import { siteFromRequest } from '../../../../lib/multistore/request';

export interface SearchAnalyticsTerm {
  term: string;
  count: number;
}

export interface SearchAnalyticsFacet {
  value: string;
  count: number;
}

export interface SearchAnalyticsResponse {
  success: boolean;
  message: string;
  data?: {
    popularQueries: SearchAnalyticsTerm[];
    queriesWithoutResults: SearchAnalyticsTerm[];
    mostSearched: SearchAnalyticsFacet[];
  };
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const queriesLimit = Number(req.query.queriesLimit) || 100;
    const productsLimit = Number(req.query.productsLimit) || 10;

    // La tienda activa: con los mapas configurados, cada una ve su propia analítica.
    const resolution = await siteFromRequest(req);

    const siteId = resolution.status === 'site' ? resolution.site.id : null;

    const [popularQueries, queriesWithoutResults, mostSearched] = await Promise.all([
      typeSenseService.getPopularSearchQueries(queriesLimit, siteId),
      typeSenseService.getQueriesWithoutResults(queriesLimit, siteId),
      typeSenseService.getMostSearchedProducts(productsLimit, siteId),
    ]);

    return res.json({
      success: true,
      message: 'Analytics retrieved successfully',
      data: {
        popularQueries,
        queriesWithoutResults,
        mostSearched,
      },
    } as SearchAnalyticsResponse);
  } catch (error) {
    console.error('[ADMIN][typesense/analytics] GET failed', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve analytics',
    } as SearchAnalyticsResponse);
  }
}
