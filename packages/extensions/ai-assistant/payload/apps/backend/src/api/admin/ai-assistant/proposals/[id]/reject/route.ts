import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../../modules/ai-assistant';
import { saveMemory, type MemoryStore } from '../../../../../../modules/ai-assistant/ai/memory';

type AiService = any;

/** POST /admin/ai-assistant/proposals/:id/reject — descarta la propuesta. */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const reviewedBy = req.auth_context?.actor_id ?? 'unknown';
  // El motivo es opcional (no hay validador en esta ruta); si viene, se guarda.
  const reason =
    typeof (req.body as { reason?: unknown })?.reason === 'string'
      ? ((req.body as { reason?: string }).reason as string).trim()
      : '';

  const proposal = await service.retrieveProposal(req.params.id).catch(() => null);
  if (!proposal) {
    res.status(404).json({ message: 'Propuesta no encontrada.' });
    return;
  }
  if (proposal.status !== 'pending') {
    res.status(409).json({ message: `La propuesta ya está en estado "${proposal.status}".` });
    return;
  }

  await service.updateProposals({ id: proposal.id, status: 'rejected', reviewed_by: reviewedBy });

  // Aprendizaje: por qué se rechazó (para no volver a proponer lo mismo). Best-effort.
  try {
    await saveMemory(service as MemoryStore, {
      tenantId: 'default',
      agentKey: proposal.agent_key ?? null,
      memoryType: 'decision',
      title: `Propuesta rechazada: ${proposal.title}`,
      content: `Se rechazó la propuesta "${proposal.title}". ${proposal.summary ?? ''}${
        reason ? `\nMotivo: ${reason}` : ''
      }`,
      summary: reason || null,
      source: 'proposal',
      sourceRefId: proposal.id,
      importanceScore: 65,
      confidenceScore: 75,
      status: 'active',
      createdBy: reviewedBy,
    });
  } catch {
    // best-effort
  }

  res.json({ id: proposal.id, status: 'rejected' });
};
