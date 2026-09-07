import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import TypeSenseService from '../../../../../modules/typesense/service';
import { CollectionSchema } from 'typesense/lib/Typesense/Collection';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { collectionForSite } from '../../../../../modules/typesense/site-collection';

/**
 * GET /admin/typesense/collections/[id]
 * Returns detailed information about a specific Typesense collection
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const { id: collectionName } = req.params as { id: string };

    /**
     * Con colecciones separadas por tienda, mirar la de otra expone su catálogo entero
     * —schema, cantidad de documentos y facetas—. Sólo se deja ver la que le
     * corresponde a la tienda activa.
     *
     * Sin el mapa configurado todas resuelven a la global, así que hoy esto no cambia
     * nada: es el guard que ya queda puesto para cuando el equipo las separe.
     */
    const resolution = await siteFromRequest(req);
    if (resolution.status === 'site') {
      const own = collectionForSite(new TypeSenseService().collectionName, resolution.site.id);
      if (collectionName !== own) {
        // 404 y no 403: un 403 confirmaría que la colección existe.
        res.status(404).json({ success: false, message: 'Collection not found' });
        return;
      }
    }

    if (!collectionName) {
      res.status(400).json({
        success: false,
        message: 'Collection name es requerido',
      });
      return;
    }

    const typesenseService = new TypeSenseService();
    const collectionInfo: CollectionSchema =
      await typesenseService.getCollectionInfo(collectionName);

    res.status(200).json({
      success: true,
      data: collectionInfo,
    });
  } catch (error: unknown) {
    console.error('Error al obtener información de la colección:', error);
    res.status(500).json({
      success: false,
      message: `Error interno del servidor: ${(error instanceof Error ? error.message : 'Internal server error')}`,
    });
  }
}
