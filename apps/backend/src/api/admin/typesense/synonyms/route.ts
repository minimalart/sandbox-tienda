import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import TypeSenseService from '../../../../modules/typesense/service';
import { Synonym, SynonymsResponse } from '../../../../modules/typesense/types';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { collectionForSite } from '../../../../modules/typesense/site-collection';


/**
 * La colección de la tienda activa. Sin mapa configurado devuelve la global, así que
 * hoy el comportamiento es el de siempre.
 */
const collectionOf = async (
  req: MedusaRequest,
  fallback: string,
): Promise<string> => {
  const resolution = await siteFromRequest(req);
  return collectionForSite(
    fallback,
    resolution.status === 'site' ? resolution.site.id : null,
    typeof req.query.collection === 'string' ? req.query.collection : undefined,
  );
};

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const collection = await collectionOf(req, typeSenseService.collectionName);

    const synonyms: Synonym[] = await typeSenseService.getSynonyms(collection);

    return res.json({
      success: true,
      data: synonyms,
      message: 'Synonyms retrieved successfully',
    } as SynonymsResponse);
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Synonyms retrieval failed',
    } as SynonymsResponse);
  }
}
