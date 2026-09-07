import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { listTemplates } from '../../../modules/demo-store/templates';

/** Demo template registry for the wizard's template selector. */
export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.status(200).json({ demo_templates: listTemplates() });
}
