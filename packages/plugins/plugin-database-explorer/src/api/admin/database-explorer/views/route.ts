import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { databaseExplorerService } from '../utils';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const views = await databaseExplorerService(req).listSavedViews();
    return res.status(200).json({ views });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error loading saved views';
    return res.status(400).json({ message });
  }
}
