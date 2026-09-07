import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { actorId, databaseExplorerService } from '../utils';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service = databaseExplorerService(req);
    const includeDisabled = req.query.include_disabled === 'true';
    const tables = await service.listTables(includeDisabled);
    await service.audit({
      user_id: actorId(req),
      action: 'list_tables',
      success: true,
    });
    return res.status(200).json({ tables });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error loading tables';
    return res.status(400).json({ message });
  }
}
