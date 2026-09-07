import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { databaseExplorerService } from '../utils';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const graph = await databaseExplorerService(req).schemaGraph();
    return res.status(200).json({ graph });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error loading schema graph';
    return res.status(400).json({ message });
  }
}
