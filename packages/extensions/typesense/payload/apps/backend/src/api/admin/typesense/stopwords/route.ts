import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import TypeSenseService from '../../../../modules/typesense/service';
import { StopWord, StopWordsResponse } from '../../../../modules/typesense/types';

/**
 * GET /api/admin/typesense/stopwords
 * Obtiene todas las listas de stop words
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const stopwordLists: StopWord[] = await typeSenseService.getStopwordLists();

    res.json({
      success: true,
      data: stopwordLists,
      message: 'StopWords retrieved successfully',
    } as StopWordsResponse);
  } catch {
    res.status(500).json({
      success: false,
      message: 'StopWords retrieval failed',
    } as StopWordsResponse);
  }
}
