import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../../modules/ai-assistant';
import type { AdminMemoryFeedbackType } from '../../../validators';

type AiService = any;

const clamp = (n: number) => Math.min(Math.max(n, 0), 100);

/**
 * POST /admin/ai-assistant/memory/:id/feedback — útil/no útil.
 * Útil sube confianza; no útil la baja y, si queda muy baja, archiva la memoria.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminMemoryFeedbackType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const { id } = req.params;
  const current = await service.retrieveAgentMemory(id).catch(() => null);
  if (!current) {
    res.status(404).json({ message: 'Memoria no encontrada.' });
    return;
  }
  const base = typeof current.confidence_score === 'number' ? current.confidence_score : 70;
  const confidence = clamp(base + (req.validatedBody.useful ? 10 : -25));
  const patch: Record<string, any> = { id, confidence_score: confidence };
  if (!req.validatedBody.useful && confidence < 20) patch.status = 'archived';
  const memory = await service.updateAgentMemories(patch);
  res.json({ memory });
};
