import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../../../../modules/ai-assistant';
import { runWorkflow } from '../../../../../../../modules/ai-assistant/ai/workflow-engine';
import type { AiStore } from '../../../../../../../modules/ai-assistant/ai/agent';
import { AdminResumeWorkflowSchema } from '../../../../validators';

type AiService = any;

/**
 * POST /admin/ai-assistant/workflows/runs/:runId/resume — reanuda (o cancela) una
 * corrida pausada en needs_input. Si se aprueba, marca el paso como aprobado y
 * continúa el motor desde donde quedó.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const run = await service.retrieveWorkflowRun(req.params.runId).catch(() => null);
  if (!run) {
    res.status(404).json({ message: 'Corrida de workflow no encontrada.' });
    return;
  }
  let body: ReturnType<typeof AdminResumeWorkflowSchema.parse>;
  try {
    body = AdminResumeWorkflowSchema.parse(req.body);
  } catch (e) {
    res.status(400).json({ message: (e as Error).message });
    return;
  }
  if (run.status !== 'needs_input') {
    res.status(409).json({ message: `El workflow no está esperando aprobación (estado: ${run.status}).` });
    return;
  }

  if (!body.approved) {
    await service.updateWorkflowRuns({ id: run.id, status: 'failed', error: 'Rechazado por el usuario.' });
    res.json({ status: 'failed', runId: run.id });
    return;
  }

  const defRows = await service.listWorkflowDefinitions({ key: run.workflow_key }, { take: 1 });
  const def = defRows?.[0];
  if (!def) {
    res.status(404).json({ message: 'Definición del workflow no encontrada.' });
    return;
  }

  // Marcar como aprobado el paso que estaba esperando, y volver a 'pending' para que el motor lo corra.
  const checklist = Array.isArray(run.checklist) ? run.checklist : [];
  const gated = checklist.find((c: { status: string }) => c.status === 'needs_input');
  const state =
    run.state && typeof run.state === 'object' ? (run.state as Record<string, unknown>) : {};
  state.__approved = {
    ...((state.__approved as Record<string, boolean>) ?? {}),
    ...(gated ? { [gated.key]: true } : {}),
  };
  if (gated) gated.status = 'pending';
  await service.updateWorkflowRuns({ id: run.id, state, checklist, status: 'running' });

  try {
    const result = await runWorkflow({
      store: service as AiStore,
      nativeCtx: { container: req.scope, store: service as AiStore },
      definition: {
        key: def.key,
        name: def.name,
        description: def.description,
        steps: Array.isArray(def.steps) ? def.steps : [],
        final_action: def.final_action ?? null,
      },
      input: (run.input as Record<string, unknown>) ?? {},
      runId: run.id,
      createdBy: run.created_by ?? null,
    });
    res.json({ status: result.status, runId: result.runId });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
};
