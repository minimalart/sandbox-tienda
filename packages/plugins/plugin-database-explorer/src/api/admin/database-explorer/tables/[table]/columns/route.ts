import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { actorId, databaseExplorerService } from '../../../utils';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service = databaseExplorerService(req);
    const table = await service.retrieveDefinition(String(req.params.table), true);
    await service.audit({
      user_id: actorId(req),
      action: 'list_columns',
      table_name: table.table_name,
      success: true,
    });
    return res.status(200).json({ table, columns: table.columns });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error loading columns';
    return res.status(400).json({ message });
  }
}
