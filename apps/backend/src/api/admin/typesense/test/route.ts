import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import TypeSenseService from '../../../../modules/typesense/service';

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  try {
    const typesenseService = new TypeSenseService();

    // Search for all products to get accurate count (search is real-time, not cached)
    const searchResults = await typesenseService.advancedSearch({
      q: '*',
      query_by: 'title',
      per_page: 5,
      page: 1,
    });

    console.log('Search results:', {
      found: searchResults.found,
      hits: searchResults.hits?.length || 0,
      out_of: searchResults.out_of,
    });

    const actualCount = searchResults.found || 0;

    res.json({
      success: true,
      collection: typesenseService.collectionName,
      documentCount: actualCount,
      sampleProducts: searchResults.hits || [],
      message: `Found ${actualCount} products in collection`,
    });
  } catch (error) {
    console.error('Typesense test error:', error);
    res.status(500).json({
      success: false,
      collection: '',
      documentCount: 0,
      sampleProducts: [],
      message: error instanceof Error ? error.message : 'Failed to test collection',
    });
  }
};
