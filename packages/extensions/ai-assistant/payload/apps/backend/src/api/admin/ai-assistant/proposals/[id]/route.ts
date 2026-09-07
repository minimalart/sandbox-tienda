import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../modules/ai-assistant';

type AiService = any;

/** GET /admin/ai-assistant/proposals/:id — detalle de una propuesta. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const proposal = await service.retrieveProposal(req.params.id).catch(() => null);
  if (!proposal) {
    res.status(404).json({ message: 'Propuesta no encontrada.' });
    return;
  }
  res.json({ proposal });
};
