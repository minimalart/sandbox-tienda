import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../../modules/ai-assistant';
import {
  executeProposal,
  type AiStore,
  type ProposedAction,
} from '../../../../../../modules/ai-assistant/ai/agent';
import { saveMemory, type MemoryStore } from '../../../../../../modules/ai-assistant/ai/memory';

type AiService = any;

/** Guarda el aprendizaje de una propuesta aprobada (best-effort: no rompe el approve). */
async function rememberApproval(
  service: AiService,
  proposal: any,
  outcome: string,
  createdBy: string,
): Promise<void> {
  try {
    await saveMemory(service as MemoryStore, {
      tenantId: 'default',
      agentKey: proposal.agent_key ?? null,
      memoryType: 'proposal_feedback',
      title: `Propuesta aprobada: ${proposal.title}`,
      content: `Se aprobó la propuesta "${proposal.title}". ${proposal.summary ?? ''}\nResultado de ejecución: ${outcome}.`,
      summary: proposal.summary ?? null,
      source: 'proposal',
      sourceRefId: proposal.id,
      importanceScore: 70,
      confidenceScore: 80,
      status: 'active',
      createdBy,
    });
  } catch {
    // best-effort
  }
}

/**
 * POST /admin/ai-assistant/proposals/:id/approve — aprueba y ejecuta las acciones
 * de la propuesta por el mismo camino gateado por políticas que el chat. La
 * aprobación humana ES el consentimiento; las acciones `prohibited` no se ejecutan.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const reviewedBy = req.auth_context?.actor_id ?? 'unknown';

  const proposal = await service.retrieveProposal(req.params.id).catch(() => null);
  if (!proposal) {
    res.status(404).json({ message: 'Propuesta no encontrada.' });
    return;
  }
  if (proposal.status !== 'pending') {
    res.status(409).json({ message: `La propuesta ya está en estado "${proposal.status}".` });
    return;
  }

  const actions: ProposedAction[] = Array.isArray(proposal.proposed_actions)
    ? (proposal.proposed_actions as ProposedAction[])
    : [];

  try {
    if (actions.length === 0) {
      // Propuesta asesora: no hay acciones que ejecutar. Aprobar = aceptar el
      // consejo; queda "approved" (no "executed"), y se implementa a mano.
      await service.updateProposals({
        id: proposal.id,
        status: 'approved',
        reviewed_by: reviewedBy,
        execution_result: null,
      });
      await rememberApproval(service, proposal, 'aprobada (asesora, sin acciones)', reviewedBy);
    } else {
      const { status, results } = await executeProposal(
        service as AiStore,
        actions,
        proposal.agent_key,
        // Sin este ctx, las acciones con tools NATIVAS (prepare_promotion,
        // create_blog_post, start_workflow…) fallaban siempre al aprobarse.
        { container: req.scope, store: service as AiStore },
      );
      await service.updateProposals({
        id: proposal.id,
        status,
        reviewed_by: reviewedBy,
        execution_result: { results },
      });
      await rememberApproval(service, proposal, status, reviewedBy);
    }
    const updated = await service.retrieveProposal(proposal.id);
    res.json({ proposal: updated });
  } catch (e) {
    await service.updateProposals({
      id: proposal.id,
      status: 'failed',
      reviewed_by: reviewedBy,
      execution_result: { error: (e as Error).message },
    });
    res.status(500).json({ message: (e as Error).message });
  }
};
