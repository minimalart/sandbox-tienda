import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { DefaultCollectionResponse } from '../../../../../modules/typesense/types';
import { CollectionSchema } from 'typesense/lib/Typesense/Collection';
import TypeSenseService from '../../../../../modules/typesense/service';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { collectionForSite } from '../../../../../modules/typesense/site-collection';


/** La colección de la tienda activa; sin mapa configurado, la global. */
const collectionOf = async (req: MedusaRequest, fallback: string): Promise<string> => {
  const resolution = await siteFromRequest(req);
  return collectionForSite(
    fallback,
    resolution.status === 'site' ? resolution.site.id : null,
    typeof req.query.collection === 'string' ? req.query.collection : undefined,
  );
};

/**
 * GET /admin/typesense/collections/default
 * Returns information about the default Typesense collection
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const typesenseService = new TypeSenseService();

    // La colección "por defecto" de la tienda activa: con el mapa configurado, cada una
    // ve la suya. Sin mapa, todas ven la global — el comportamiento de siempre.
    const defaultCollectionName = await collectionOf(req, typesenseService.collectionName);

    const defaultCollectionInfo: CollectionSchema =
      await typesenseService.getCollectionInfo(defaultCollectionName);

    res.status(200).json({
      success: true,
      data: {
        collectionName: defaultCollectionName,
        collectionInfo: defaultCollectionInfo,
      },
    } as DefaultCollectionResponse);
  } catch (error: unknown) {
    console.error('Error al obtener información de la colección por defecto:', error);
    res.status(500).json({
      success: false,
      message: `Error interno del servidor: ${(error instanceof Error ? error.message : 'Internal server error')}`,
    } as DefaultCollectionResponse);
  }
}
