import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { recalculateDynamicGroupWorkflow } from '../../../../../workflows/recalculate-dynamic-group';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await recalculateDynamicGroupWorkflow(req.scope).run({
    input: { id: req.params.id as string },
  });
  res.status(202).json({ stats: result });
}
