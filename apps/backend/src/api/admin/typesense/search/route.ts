import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { SearchParams, SearchResponse } from 'typesense/lib/Typesense/Documents';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { collectionForSite } from '../../../../modules/typesense/site-collection';
import {
  STOREFRONT_TYPESENSE_QUERY_BY,
  STOREFRONT_TYPESENSE_TYPO_PARAMS,
  normalizeTypesenseQuery,
} from '../../../../modules/typesense/search-defaults';
import TypeSenseService from '../../../../modules/typesense/service';
import { CustomSearchResponse } from '../../../../modules/typesense/types';

/**
 * POST /admin/typesense/search
 * Handles Typesense search operations with full SearchParams support
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const { searchOptions, collectionName } = req.body as {
      searchOptions: SearchParams;
      collectionName?: string;
    };

    if (!searchOptions) {
      res.status(400).json({
        success: false,
        message: 'searchOptions es requerido',
      });
      return;
    }

    const typesenseService = new TypeSenseService();

    const normalizedSearchOptions: SearchParams = {
      ...searchOptions,
      q: normalizeTypesenseQuery(typeof searchOptions.q === 'string' ? searchOptions.q : '*'),
      query_by:
        typeof searchOptions.query_by === 'string' && searchOptions.query_by.trim().length > 0
          ? searchOptions.query_by
          : STOREFRONT_TYPESENSE_QUERY_BY,
      ...STOREFRONT_TYPESENSE_TYPO_PARAMS,
    };

    /**
     * El eje de esta ruta es la COLECCIÓN, igual que en curaciones y sinónimos: no
     * hay filas de Postgres que filtrar. Sin esto, la búsqueda del backoffice pegaba
     * siempre contra la colección global aunque la tienda activa tuviera la suya, y
     * el operador veía en su buscador productos que su storefront no indexa.
     *
     * El `collectionName` EXPLÍCITO del body sigue ganando —quien lo manda sabe qué
     * pide, misma precedencia que el `?collection=` de curaciones—: esta ruta también
     * la usa la pantalla de administración de colecciones para inspeccionar una
     * cualquiera del cluster.
     */
    const resolution = await siteFromRequest(req);
    const targetCollection = collectionForSite(
      typesenseService.collectionName,
      resolution.status === 'site' ? resolution.site.id : null,
      collectionName,
    );

    const searchResults: SearchResponse<object> = await typesenseService.advancedSearch(
      normalizedSearchOptions,
      targetCollection
    );

    res.status(200).json({
      success: true,
      data: searchResults,
    } as CustomSearchResponse);
  } catch (error: unknown) {
    console.error('Error en búsqueda de Typesense:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({
      success: false,
      message: `Error interno del servidor: ${message}`,
    } as CustomSearchResponse);
  }
}
