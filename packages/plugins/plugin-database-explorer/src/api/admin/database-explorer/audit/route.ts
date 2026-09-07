import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { databaseExplorerService, queryString } from '../utils';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const result = await databaseExplorerService(req).listAudit({
      limit: Number(queryString(req.query.limit) ?? 50),
      offset: Number(queryString(req.query.offset) ?? 0),
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error loading audit';
    return res.status(400).json({ message });
  }
}
