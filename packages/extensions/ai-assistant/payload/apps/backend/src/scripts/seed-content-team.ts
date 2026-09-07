/**
 * Reconcilia el "equipo de contenido" en una base YA sembrada (el seed normal es
 * insert-if-missing y no actualiza filas existentes). Deja el flujo de recetas/
 * artículos funcionando:
 *   - Upsert del agente `redactor` con sus instrucciones canónicas (lo crea si se
 *     borró; lo actualiza si quedó con una versión vieja).
 *   - Asegura que el orquestador pueda derivar a `redactor`.
 *   - A `catalogo` (Cata) le suma la tool `link_blog_products` y el handoff a
 *     `redactor` (append, sin tocar sus instrucciones).
 *   - Elimina el agente deprecado `productos-blog` (ahora lo hace Cata).
 *
 * Seguro de re-correr. Sí PISA las instrucciones del `redactor` (agente de
 * sistema) con las canónicas; no toca las de Cata.
 *
 * Correr con:
 *   pnpm seed:content-team
 *   o: dotenv -e .env -- medusa exec ./src/scripts/seed-content-team.ts
 */
import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { AI_ASSISTANT_MODULE } from '../modules/ai-assistant';
import { NATIVE_TOOL } from '../modules/ai-assistant/ai/native-tools/names';
import { RECIPE_WORKFLOW_DEFINITION } from '../modules/ai-assistant/ai/workflows/recipe';
import { AGENTS } from './seed-ai-agents';

type AiService = any;

function addUnique<T>(list: T[] | null | undefined, value: T): T[] {
  const arr = Array.isArray(list) ? list : [];
  return arr.includes(value) ? arr : [...arr, value];
}

export default async function seedContentTeam({ container }: ExecArgs) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service: AiService = container.resolve(AI_ASSISTANT_MODULE);

  // 1) Upsert del redactor con la definición canónica.
  // Al ACTUALIZAR se preserva la identidad que les hayas puesto (name/icon/
  // description) y solo se ajusta el COMPORTAMIENTO (instructions/allowed_tools/
  // handoff_targets). Al CREAR (si falta) se usa la definición canónica completa.
  for (const key of ['orchestrator', 'redactor', 'imagenes', 'investigador'] as const) {
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
      logger.info(`[content-team] ${key}: comportamiento actualizado (se conserva su nombre).`);
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
      logger.info(`[content-team] ${key} creado.`);
    }
  }

  // 2) El orquestador se actualiza a su versión canónica en el loop de arriba
  //    (incluye la tool start_workflow + las instrucciones que usan workflows).

  // 3) Cata (catalogo): asegurar la tool de linkeo + handoff a redactor (append).
  const cata = (await service.listAgents({ key: 'catalogo' }))?.[0];
  if (cata) {
    const patch: Record<string, any> = {};
    // Solo si tiene allow-list acotada (no null = ve todas e incluye la nativa).
    if (Array.isArray(cata.allowed_tools)) {
      const has = cata.allowed_tools.some(
        (t: { tool: string }) => t.tool === NATIVE_TOOL.linkBlogProducts,
      );
      if (!has) patch.allowed_tools = [...cata.allowed_tools, { tool: NATIVE_TOOL.linkBlogProducts }];
    }
    const ht = addUnique<string>(cata.handoff_targets, 'redactor');
    if (ht.length !== (cata.handoff_targets?.length ?? 0)) patch.handoff_targets = ht;
    if (Object.keys(patch).length) {
      await service.updateAgents({ id: cata.id, ...patch });
      logger.info('[content-team] catalogo (Cata): tool link_blog_products / handoff asegurados.');
    }
  }

  // 4) Eliminar el agente deprecado productos-blog (su rol lo absorbe Cata).
  const obsolete = (await service.listAgents({ key: 'productos-blog' }))?.[0];
  if (obsolete) {
    await service.deleteAgents(obsolete.id);
    logger.info('[content-team] productos-blog eliminado (ahora lo hace Cata).');
  }

  // 5) Workflow del sistema "receta" (determinístico): investigar → redactar →
  //    [portada ∥ productos]. La definición canónica (con las tareas de cada paso)
  //    vive en `workflows/recipe.ts` y es la que usa el motor en runtime; acá solo
  //    la persistimos/actualizamos en DB para que se vea y edite desde el admin.
  const RECIPE_WORKFLOW = RECIPE_WORKFLOW_DEFINITION;
  const exW = (await service.listWorkflowDefinitions({ key: RECIPE_WORKFLOW.key }))?.[0];
  if (exW) {
    await service.updateWorkflowDefinitions({
      id: exW.id,
      name: RECIPE_WORKFLOW.name,
      description: RECIPE_WORKFLOW.description,
      steps: RECIPE_WORKFLOW.steps,
      final_action: RECIPE_WORKFLOW.final_action,
      enabled: true,
    });
    logger.info('[content-team] workflow "receta" actualizado.');
  } else {
    await service.createWorkflowDefinitions({ ...RECIPE_WORKFLOW, source: 'system', enabled: true });
    logger.info('[content-team] workflow "receta" creado.');
  }

  logger.info('[content-team] Equipo de contenido reconciliado.');
}
