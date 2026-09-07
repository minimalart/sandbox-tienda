import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { databaseExplorerService } from '../utils';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const relations = await databaseExplorerService(req).listRelations();
    return res.status(200).json({ relations });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error loading relations';
    return res.status(400).json({ message });
  }
}
