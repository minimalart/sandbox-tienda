import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { actorId, databaseExplorerService, parseFilters, queryString } from '../../../utils';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const result = await databaseExplorerService(req).runSavedView(
      String(req.params.id),
      {
        limit: queryString(req.query.limit),
        offset: queryString(req.query.offset),
        sort: queryString(req.query.sort),
        direction: queryString(req.query.direction),
        q: queryString(req.query.q),
        filters: parseFilters(req.query.filters),
      },
      actorId(req)
    );
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error running saved view';
    return res.status(400).json({ message });
  }
}
