import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { databaseExplorerService } from '../../utils';

const Body = z.object({
  table_name: z.string(),
  display_name: z.string().nullish(),
  description: z.string().nullish(),
  enabled: z.boolean().optional(),
  show_in_visual: z.boolean().optional(),
  primary_label_column: z.string().nullish(),
  default_sort_column: z.string().nullish(),
  default_sort_direction: z.enum(['asc', 'desc']).optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const tables = await databaseExplorerService(req).listAllPublicTablesForSettings();
    return res.status(200).json({ tables });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error loading settings';
    return res.status(400).json({ message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const table = await databaseExplorerService(req).upsertTableConfig(Body.parse(req.body));
    return res.status(200).json({ table });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error saving table settings';
    return res.status(400).json({ message });
  }
}
