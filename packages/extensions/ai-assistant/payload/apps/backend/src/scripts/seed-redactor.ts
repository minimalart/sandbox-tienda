/**
 * Re-siembra SOLO el agente "redactor" (por si se borró sin querer). Reusa la
 * misma definición de `seed-ai-agents.ts`, así no hay drift. Idempotente: si ya
 * existe, no lo toca.
 *
 * Correr con:
 *   pnpm seed:redactor
 *   o: dotenv -e .env -- medusa exec ./src/scripts/seed-redactor.ts
 */
import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { AI_ASSISTANT_MODULE } from '../modules/ai-assistant';
import { AGENTS } from './seed-ai-agents';

type AiService = any;

export default async function seedRedactor({ container }: ExecArgs) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service: AiService = container.resolve(AI_ASSISTANT_MODULE);

  const a = AGENTS.find((x) => x.key === 'redactor');
  if (!a) {
    logger.warn('[seed:redactor] No se encontró la definición del redactor en AGENTS.');
    return;
  }

  const existing = await service.listAgents({ key: a.key });
  if (existing?.[0]) {
    logger.info('[seed:redactor] El agente "redactor" ya existe → no se toca.');
    return;
  }

  await service.createAgents({
    key: a.key,
    name: a.name,
    description: a.description,
    instructions: a.instructions,
    is_orchestrator: Boolean(a.is_orchestrator),
    rank: a.rank,
    icon: a.icon,
    skills: a.skills,
    handoff_targets: a.handoff_targets,
    allowed_tools: a.allowed_tools,
    enabled: true,
    source: 'system',
  });
  logger.info('[seed:redactor] Agente "redactor" creado.');
}
