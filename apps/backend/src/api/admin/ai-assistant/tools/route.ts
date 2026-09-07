import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../modules/ai-assistant';
import { getToolMatrix } from '../../../../modules/ai-assistant/ai/agent';
import { defaultMode, type PolicyOverride } from '../../../../modules/ai-assistant/ai/policy';
import type { AdminSaveToolPoliciesType } from '../validators';

type AiService = any;

async function loadOverrides(service: AiService): Promise<PolicyOverride[]> {
  const rows = await service.listToolPolicies({}, { take: 1000 });
  return rows.map((r: any) => ({
    tool_name: r.tool_name,
    action: r.action,
    resource: r.resource ?? '',
    mode: r.mode,
  }));
}

/** GET /admin/ai-assistant/tools — matriz de tools/acciones con su modo efectivo. */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const overrides = await loadOverrides(service);
  const tools = await getToolMatrix(service, overrides);
  res.json({ tools });
};

/**
 * POST /admin/ai-assistant/tools — guarda overrides. Si un modo coincide con el
 * default, se borra el override (la tabla solo guarda lo que difiere del default).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSaveToolPoliciesType>,
  res: MedusaResponse,
) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const { policies } = req.validatedBody;

  for (const p of policies) {
    const resource = p.resource ?? '';
    const [existing] = await service.listToolPolicies(
      { tool_name: p.tool_name, action: p.action, resource },
      { take: 1 },
    );

    if (p.mode === defaultMode(p.tool_name, p.action, resource)) {
      if (existing) await service.deleteToolPolicies(existing.id);
      continue;
    }

    if (existing) {
      await service.updateToolPolicies({ id: existing.id, mode: p.mode });
    } else {
      await service.createToolPolicies({
        tool_name: p.tool_name,
        action: p.action,
        resource,
        mode: p.mode,
      });
    }
  }

  const overrides = await loadOverrides(service);
  const tools = await getToolMatrix(service, overrides);
  res.json({ tools });
};
