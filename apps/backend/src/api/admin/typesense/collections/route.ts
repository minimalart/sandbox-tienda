import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { CollectionSchema } from 'typesense/lib/Typesense/Collection';
import TypeSenseService from '../../../../modules/typesense/service';

/**
 * GET /admin/typesense/collections
 * Returns all available Typesense collections
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const typesenseService = new TypeSenseService();
    const collections: CollectionSchema[] = await typesenseService.getCollections();

    res.status(200).json({
      success: true,
      data: collections,
    });
  } catch (error: unknown) {
    console.error('Error al obtener colecciones de Typesense:', error);
    res.status(500).json({
      success: false,
      message: `Error interno del servidor: ${(error instanceof Error ? error.message : 'Internal server error')}`,
    });
  }
}
