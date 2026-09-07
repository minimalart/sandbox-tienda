/**
 * Perfil de capacidades de un agente.
 *
 * Un agente deja de "ver ciertas tools" y pasa a recibir un AMBIENTE DE EJECUCIÓN:
 * qué tools, con qué acciones y sobre qué recursos; si puede leer y escribir
 * memoria; a quién puede derivar; cuánta autonomía tiene.
 *
 * Cierra además un agujero medido: `ToolScope.resources` y `ToolScope.actions`
 * estaban declarados en el tipo, se aceptaban en el zod de la API y los escribía
 * `normalizeManifest` al importar agentes de terceros… y no los leía NADIE.
 * `isToolAllowed` sólo miraba `a.tool`, y el producto cartesiano de
 * `buildToolsForModel` salía del enum del JSON-schema de la tool, no del scope del
 * agente. O sea: un agente con `{ tool: 'orders', actions: ['list'] }` podía
 * llamar `create`. Era un contrato declarado y no implementado.
 *
 * Se implementa en vez de borrarse porque borrarlo exigiría migrar jsonb en
 * producción y romper el formato de manifiesto que terceros ya pueden emitir,
 * mientras que implementarlo es aditivo, hace que los datos existentes signifiquen
 * lo que dicen, y sólo puede ANGOSTAR permisos, nunca ampliarlos.
 */
import type { ResolvedAgent, ToolScope } from './agents';
import type { PolicyMode } from './types';

export type ToolCapability = {
  /** `null` = toda la superficie no prohibida globalmente (el `allowed_tools: null` de hoy). */
  allow: ToolScope[] | null;
  /** Gana sobre `allow`. Hoy nadie lo puebla; lo pide un `mcp__x__*` con excepciones. */
  deny?: ToolScope[];
};

export type MemoryCapability = {
  read: boolean;
  write: boolean;
  /** `null` = los tipos por defecto. */
  types: string[] | null;
};

export type CapabilityProfile = {
  tools: ToolCapability;
  memory: MemoryCapability;
  /** Proyección de la superficie web sobre las tools que la proveen. */
  web: { search: boolean; fetch: boolean };
  subagents: {
    canHandoff: boolean;
    targets: string[];
    canStartWorkflows: boolean;
  };
};

/** ¿El scope matchea este nombre de tool? Soporta comodín de sufijo. */
function matches(scope: ToolScope, name: string): boolean {
  return scope.tool.endsWith('*')
    ? name.startsWith(scope.tool.slice(0, -1))
    : scope.tool === name;
}

function seesTool(agent: ResolvedAgent, prefix: string): boolean {
  if (agent.allowedTools == null) return true;
  return agent.allowedTools.some((t) => t.tool.startsWith(prefix));
}

/**
 * Deriva el perfil de las columnas que YA existen (`allowed_tools`,
 * `memory_types`, `handoff_targets`). Función pura, cero migración, cero cambio en
 * la UI de agentes: que la arquitectura objetivo no dependa de una migración es un
 * requisito y no una comodidad, porque en este monorepo las migraciones se pueden
 * saltear en silencio.
 *
 * El día que aparezca una capability sin columna (`deny`, autonomía por agente) se
 * agrega una `capabilities jsonb` nullable y el resolver hace
 * `{ ...derivadoDeColumnas, ...(row.capabilities ?? {}) }`.
 */
export function resolveCapabilityProfile(agent: ResolvedAgent): CapabilityProfile {
  return {
    tools: { allow: agent.allowedTools },
    memory: { read: true, write: true, types: agent.memoryTypes },
    web: {
      search: seesTool(agent, 'mcp__tavily'),
      fetch: seesTool(agent, 'mcp__firecrawl'),
    },
    subagents: {
      canHandoff: agent.handoffTargets.length > 0,
      targets: agent.handoffTargets,
      // Ya se calculaba así, inline, en el medio del loop.
      canStartWorkflows:
        agent.allowedTools == null ||
        agent.allowedTools.some((t) => t.tool === 'start_workflow'),
    },
  };
}

/**
 * El scope que gobierna a esta tool, o `null` si el agente no la puede ver.
 * `deny` gana sobre `allow`; sin allow-list, la tool queda con un scope abierto.
 */
export function scopeFor(cap: ToolCapability, name: string): ToolScope | null {
  if (cap.deny?.some((s) => matches(s, name))) return null;
  if (!cap.allow) return { tool: name };
  return cap.allow.find((s) => matches(s, name)) ?? null;
}

/**
 * ¿El scope permite este combo action × resource?
 *
 * Un scope sin `actions` (o sin `resources`) no restringe ese eje — es el caso de
 * los agentes de hoy, que guardan `{ tool }` pelado. La acción comodín `'*'` es la
 * de una tool que no expone enum de `action`: no hay nada que acotar.
 */
export function comboAllowed(
  scope: ToolScope,
  action: string,
  resource: string | null,
): boolean {
  if (scope.actions?.length && action !== '*' && !scope.actions.includes(action)) {
    return false;
  }
  if (scope.resources?.length && resource !== null && !scope.resources.includes(resource)) {
    return false;
  }
  return true;
}

/**
 * Decisión autoritativa: qué modo le corresponde a una llamada concreta según el
 * perfil. Devuelve `null` cuando el perfil no opina y hay que dejar decidir a la
 * ToolPolicy global.
 */
export function modeFromProfile(
  profile: CapabilityProfile,
  name: string,
  action: string,
  resource: string | null,
): PolicyMode | null {
  const scope = scopeFor(profile.tools, name);
  if (!scope) return 'prohibited';
  return comboAllowed(scope, action, resource) ? null : 'prohibited';
}

/**
 * Por qué el enforcement NO va como hook.
 *
 * Tentaba resolverlo con un `beforeToolExecute` que devolviera `{ skip }`: entraba
 * sin tocar el loop y quedaba lindo como demostración de los hooks. Pero un skip
 * deja `call.mode` en `auto`, y el `ok` de la actividad se calcula justamente a
 * partir del modo: una acción BLOQUEADA se pintaría en VERDE en la cadena de
 * actividad del chat. Y tener dos caminos de prohibición —la ToolPolicy por un
 * lado, el perfil por otro— es exactamente la duplicación que este refactor vino
 * a sacar.
 *
 * Por eso `modeFromProfile` se consulta en la CLASIFICACIÓN, junto a
 * `resolveMode`: una sola noción de `prohibited`, un solo texto de rechazo, un
 * solo evento `tool_rejected`.
 */
