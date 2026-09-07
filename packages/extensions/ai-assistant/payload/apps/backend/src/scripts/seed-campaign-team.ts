/**
 * Reconcilia el "equipo de campaña comercial" en una base YA sembrada (el seed
 * normal es insert-if-missing y no actualiza filas existentes). Deja el wizard de
 * "Campaña comercial" funcionando end-to-end:
 *   - Upsert de los agentes nuevos `promociones` y `validador` (subagentes headless
 *     del workflow).
 *   - Reconcilia el comportamiento de `orchestrator` (wizard + tools de campaña),
 *     `redactor` (puede crear LANDINGS) e `imagenes` (puede crear BANNERS) a su
 *     definición canónica de `seed-ai-agents.ts`.
 *   - Upsert del workflow de sistema `campania_comercial` (pasos condicionales por
 *     entregable + grupo paralelo de contenido + final_action confirm).
 *   - Overrides de ToolPolicy para que los subagentes HEADLESS puedan CREAR los
 *     borradores de banner/landing por el MCP (las escrituras del MCP son `ask` por
 *     defecto y headless NO ejecuta `ask`; bajamos a `auto` solo el CREATE de esos
 *     dos recursos — publicar sigue siendo una acción explícita del preview).
 *
 * Seguro de re-correr. Correr con:
 *   pnpm seed:campaign-team
 *   o: dotenv -e .env -- medusa exec ./src/scripts/seed-campaign-team.ts
 */
import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { AI_ASSISTANT_MODULE } from '../modules/ai-assistant';
import { CAMPAIGN_WORKFLOW_DEFINITION } from '../modules/ai-assistant/ai/workflows/campaign';
import { AGENTS } from './seed-ai-agents';

type AiService = any;

// La definición canónica vive en `workflows/campaign.ts` y es la que usa el motor
// en runtime (igual que receta); acá solo se refleja en DB para verla en el admin.
const CAMPAIGN_WORKFLOW = CAMPAIGN_WORKFLOW_DEFINITION;

const POLICY_OVERRIDES = [
  { tool_name: 'manage_minimalart_extensions', action: 'create', resource: 'banners', mode: 'auto' as const },
  { tool_name: 'manage_minimalart_extensions', action: 'create', resource: 'landing_pages', mode: 'auto' as const },
];

export default async function seedCampaignTeam({ container }: ExecArgs) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service: AiService = container.resolve(AI_ASSISTANT_MODULE);

  // 1) Upsert de agentes (canónicos de seed-ai-agents.ts): los nuevos + los que
  //    cambiaron comportamiento para la campaña.
  for (const key of ['orchestrator', 'redactor', 'imagenes', 'promociones', 'validador'] as const) {
    const seed = AGENTS.find((a) => a.key === key);
    if (!seed) continue;
    const existing = (await service.listAgents({ key }))?.[0];
    if (existing) {
      await service.updateAgents({
        id: existing.id,
        instructions: seed.instructions,
        allowed_tools: seed.allowed_tools,
        handoff_targets: seed.handoff_targets,
        enabled: true,
      });
      logger.info(`[campaign-team] ${key}: comportamiento actualizado.`);
    } else {
      await service.createAgents({
        key,
        name: seed.name,
        description: seed.description,
        instructions: seed.instructions,
        is_orchestrator: Boolean(seed.is_orchestrator),
        rank: seed.rank,
        icon: seed.icon,
        skills: seed.skills,
        handoff_targets: seed.handoff_targets,
        allowed_tools: seed.allowed_tools,
        enabled: true,
        source: 'system',
      });
      logger.info(`[campaign-team] ${key} creado.`);
    }
  }

  // 2) Workflow de sistema "campania_comercial".
  const exW = (await service.listWorkflowDefinitions({ key: CAMPAIGN_WORKFLOW.key }))?.[0];
  if (exW) {
    await service.updateWorkflowDefinitions({
      id: exW.id,
      name: CAMPAIGN_WORKFLOW.name,
      description: CAMPAIGN_WORKFLOW.description,
      steps: CAMPAIGN_WORKFLOW.steps,
      final_action: CAMPAIGN_WORKFLOW.final_action,
      enabled: true,
    });
    logger.info('[campaign-team] workflow "campania_comercial" actualizado.');
  } else {
    await service.createWorkflowDefinitions({ ...CAMPAIGN_WORKFLOW, source: 'system', enabled: true });
    logger.info('[campaign-team] workflow "campania_comercial" creado.');
  }

  // 3) Overrides de ToolPolicy: los subagentes headless ejecutan solo `auto`; el
  //    CREATE de banner/landing por el MCP es `ask` por defecto → lo bajamos a
  //    `auto` (crean BORRADORES; publicar sigue siendo acción explícita del preview).
  for (const o of POLICY_OVERRIDES) {
    const existing = (
      await service.listToolPolicies({ tool_name: o.tool_name, action: o.action, resource: o.resource })
    )?.[0];
    if (existing) {
      if (existing.mode !== o.mode) {
        await service.updateToolPolicies({ id: existing.id, mode: o.mode });
        logger.info(`[campaign-team] policy ${o.tool_name}:${o.action}:${o.resource} → ${o.mode} (actualizado).`);
      }
    } else {
      await service.createToolPolicies(o);
      logger.info(`[campaign-team] policy ${o.tool_name}:${o.action}:${o.resource} → ${o.mode} (creado).`);
    }
  }

  logger.info('[campaign-team] Equipo de campaña comercial reconciliado.');
}
