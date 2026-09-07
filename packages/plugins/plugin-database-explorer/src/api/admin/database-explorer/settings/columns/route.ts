import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { databaseExplorerService } from '../../utils';

const Body = z.object({
  table_name: z.string(),
  column_name: z.string(),
  display_name: z.string().nullish(),
  data_type: z.string().nullish(),
  visible: z.boolean().optional(),
  masked: z.boolean().optional(),
  searchable: z.boolean().optional(),
  filterable: z.boolean().optional(),
  sortable: z.boolean().optional(),
  sensitive: z.boolean().optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = Body.parse(req.body);
    const column = await databaseExplorerService(req).upsertColumnConfig(body.table_name, body);
    return res.status(200).json({ column });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error saving column settings';
    return res.status(400).json({ message });
  }
}
