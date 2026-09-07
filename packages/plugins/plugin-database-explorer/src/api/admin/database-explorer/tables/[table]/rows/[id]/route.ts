import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { actorId, databaseExplorerService } from '../../../../utils';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service = databaseExplorerService(req);
    const result = await service.getRow(
      String(req.params.table),
      String(req.params.id),
      actorId(req)
    );
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error loading row';
    return res.status(404).json({ message });
  }
}
