import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import TypeSenseService from '../../../../../modules/typesense/service';
import { StopWord, StopWordFormData, StopWordResponse } from '../../../../../modules/typesense/types';

/**
 * GET /api/admin/typesense/stopwords/[id]
 * Obtiene una lista específica de stop words por ID
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'StopWord ID is required',
      } as StopWordResponse);
    }

    const stopwordList: StopWord | null = await typeSenseService.getStopwordList(id);

    if (!stopwordList) {
      return res.status(404).json({
        success: false,
        message: 'StopWord not found',
      } as StopWordResponse);
    }

    return res.json({
      success: true,
      data: stopwordList,
      message: 'StopWord retrieved successfully',
    } as StopWordResponse);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'StopWord retrieval failed',
    } as StopWordResponse);
  }
}

/**
 * PUT /api/admin/typesense/stopwords/[id]
 * Creates or updates a stopword list
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const { id } = req.params;
    const body = req.body as StopWordFormData;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'StopWord ID is required',
      } as StopWordResponse);
    }

    if (!body.stopwords || !Array.isArray(body.stopwords)) {
      return res.status(400).json({
        success: false,
        message: 'StopWords array is required',
      } as StopWordResponse);
    }

    // Filter and clean stopwords
    const filteredStopwords = body.stopwords
      .filter((word) => word && typeof word === 'string' && word.trim().length > 0)
      .map((word) => word.trim().toLowerCase());

    if (filteredStopwords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one valid stopword is required',
      } as StopWordResponse);
    }

    const result: StopWord = await typeSenseService.upsertStopwordList(
      id,
      filteredStopwords,
      body.locale || 'es'
    );

    return res.json({
      success: true,
      data: result,
      message: 'StopWord saved successfully',
    } as StopWordResponse);
  } catch (error) {
    console.error('Error al guardar stopword:', error);
    return res.status(500).json({
      success: false,
      message: 'StopWord save failed',
    } as StopWordResponse);
  }
}

/**
 * DELETE /api/admin/typesense/stopwords/[id]
 * Deletes a stopword list by ID
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typeSenseService = new TypeSenseService();
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'StopWord ID is required',
      } as StopWordResponse);
    }

    await typeSenseService.deleteStopwordList(id);

    return res.json({
      success: true,
      message: 'StopWord deleted successfully',
    } as StopWordResponse);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'StopWord deletion failed',
    } as StopWordResponse);
  }
}
