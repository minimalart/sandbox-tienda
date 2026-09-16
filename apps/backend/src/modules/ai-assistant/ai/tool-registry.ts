import { createHash } from 'crypto';
import { getMcpTools } from '../../../api/mcp/_loader';
import { callExternalTool, discoverExternalTools, type TransportKind } from './mcp-client';
import { resolveAuthHeaders } from './mcp-auth';
import { NATIVE_TOOL_DEFS } from './native-tools';
import type { ToolPolicyHints } from './policy';

/**
 * Agregador de tools: unifica el MCP INTERNO (`mcp-medusa`, in-process) con N
 * servidores MCP EXTERNOS detrás de una sola API, con routing por nombre.
 *
 * - El interno conserva sus nombres (`manage_medusa_admin_*`) → no rompe
 *   `ToolPolicy`, allow-lists ni labels existentes.
 * - Los externos se exponen namespaced `mcp__<serverKey>__<tool>` y se descubren
 *   de la `tools_cache` persistida de cada servidor (SIN abrir red en el hot path
 *   del loop). El refresh de ese cache es on-demand (`refreshServerTools`).
 * - La ejecución de una tool externa abre una conexión efímera (ver `mcp-client`).
 */

export const EXTERNAL_PREFIX = 'mcp__';
const DISCOVER_TIMEOUT_MS = 8_000;
const EXEC_TIMEOUT_MS = 30_000;
const OPENAI_NAME_MAX = 64;

type RegistryStore = {
  listMcpServers(filters?: any, config?: any): Promise<any[]>;
  retrieveMcpServer(id: string): Promise<any>;
  updateMcpServers(data: any): Promise<any>;
};

/** Tool resuelta en el formato que consume `buildToolsForModel` (`definition`). */
export type UnifiedTool = {
  // parameters = JSON Schema laxo (igual que McpToolDef); `any` para encajar con toolActions/toolResources.
  definition: { name: string; description?: string; parameters?: any };
  origin: 'internal' | 'external';
  serverId?: string;
  /** Nombre original (sin namespace) para ejecutar contra el servidor externo. */
  originalName?: string;
  policyHints?: ToolPolicyHints;
};

type CachedTool = {
  name: string;
  namespaced_name: string;
  description?: string;
  parameters?: unknown;
  read_only_hint?: boolean;
};

function sanitizeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'x';
}

/**
 * Nombre namespaced de una tool externa, válido para OpenAI (`^[A-Za-z0-9_-]{1,64}$`).
 * Si excede 64, trunca y agrega un hash corto y estable (el valor resultante se
 * persiste en la cache, así el routing no depende de recomputarlo).
 */
export function namespacedName(serverKey: string, toolName: string): string {
  const base = `${EXTERNAL_PREFIX}${sanitizeSegment(serverKey)}__${sanitizeSegment(toolName)}`;
  if (base.length <= OPENAI_NAME_MAX) return base;
  const hash = createHash('sha256').update(`${serverKey}__${toolName}`).digest('hex').slice(0, 6);
  return `${base.slice(0, OPENAI_NAME_MAX - hash.length - 1)}_${hash}`;
}

/**
 * Descubre TODAS las tools disponibles: el interno (cacheado por el paquete) +
 * las externas desde la `tools_cache` de los servidores habilitados. No abre
 * conexión a terceros (barato para llamarse por paso del loop). Aislado: si el
 * interno falla, devuelve igual los externos y viceversa.
 */
export async function discoverAllTools(store: RegistryStore): Promise<UnifiedTool[]> {
  const out: UnifiedTool[] = [];

  try {
    const mcp = await getMcpTools();
    const internal = await mcp.discoverTools();
    for (const t of internal) {
      if (t?.definition?.name) out.push({ definition: t.definition, origin: 'internal' });
    }
  } catch {
    // interno no disponible: seguimos con externos
  }

  let servers: Array<Record<string, unknown>> = [];
  try {
    servers = await store.listMcpServers({ enabled: true }, { take: 100 });
  } catch {
    servers = [];
  }
  for (const s of servers) {
    const cache = Array.isArray(s.tools_cache) ? (s.tools_cache as CachedTool[]) : [];
    for (const t of cache) {
      if (!t?.namespaced_name) continue;
      out.push({
        definition: {
          name: t.namespaced_name,
          description: t.description,
          parameters: t.parameters,
        },
        origin: 'external',
        serverId: String(s.id),
        originalName: t.name,
        policyHints: {
          read_only_hint: t.read_only_hint === true,
          trusted: s.trust_read_only_hints === true,
          has_action: Object.prototype.hasOwnProperty.call((t.parameters as any)?.properties ?? {}, 'action'),
        },
      });
    }
  }

  // Tools NATIVAS (in-process): el modelo las ve como cualquier tool; la ejecución
  // la intercepta `execTool` (no pasa por `executeUnifiedTool`/MCP).
  for (const d of NATIVE_TOOL_DEFS) {
    out.push({ definition: { name: d.name, description: d.description, parameters: d.parameters }, origin: 'internal' });
  }

  return out;
}

type ToolContent = { content: Array<{ type: string; text: string }> };

/**
 * Ejecuta una tool por nombre, ruteando por origen: nombres con prefijo `mcp__`
 * van al servidor externo correspondiente (conexión efímera, headers en runtime);
 * el resto va al MCP interno.
 */
export async function executeUnifiedTool(
  store: RegistryStore,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolContent> {
  if (!name.startsWith(EXTERNAL_PREFIX)) {
    const mcp = await getMcpTools();
    const rawTools = await mcp.discoverTools();
    return mcp.executeToolOptimized(rawTools, name, args);
  }

  const servers = await store.listMcpServers({ enabled: true }, { take: 100 }).catch(() => []);
  for (const s of servers) {
    const cache = Array.isArray(s.tools_cache) ? (s.tools_cache as CachedTool[]) : [];
    const hit = cache.find((t) => t?.namespaced_name === name);
    if (!hit) continue;
    const headers = await resolveAuthHeaders(store, s);
    return callExternalTool(
      {
        url: String(s.url),
        transport: (s.transport === 'sse' ? 'sse' : 'http') as TransportKind,
        headers,
        timeoutMs: EXEC_TIMEOUT_MS,
      },
      hit.name,
      args ?? {},
    );
  }
  return {
    content: [
      {
        type: 'text',
        text: `La herramienta "${name}" no está disponible: el servidor MCP fue removido o deshabilitado. Avisale al usuario en vez de reintentar.`,
      },
    ],
  };
}

/**
 * Conecta a un servidor externo, descubre sus tools, las namespacea y persiste la
 * `tools_cache` + estado de salud. Es la acción del botón "Probar/Refrescar".
 */
export async function refreshServerTools(
  store: RegistryStore,
  serverId: string,
): Promise<{ ok: boolean; tools_count: number; error?: string; transport?: TransportKind }> {
  const server = await store.retrieveMcpServer(serverId).catch(() => null);
  if (!server) return { ok: false, tools_count: 0, error: 'Servidor no encontrado.' };

  const headers = await resolveAuthHeaders(store, server);
  const result = await discoverExternalTools({
    url: String(server.url),
    transport: (server.transport === 'sse' ? 'sse' : 'http') as TransportKind,
    headers,
    timeoutMs: DISCOVER_TIMEOUT_MS,
  });

  if (!result.ok) {
    await store
      .updateMcpServers({
        id: serverId,
        health: 'error',
        last_error: result.error ?? 'No se pudo conectar al servidor MCP.',
        last_connected_at: new Date(),
      })
      .catch(() => {});
    return { ok: false, tools_count: 0, error: result.error };
  }

  const cache: CachedTool[] = result.tools.map((t) => ({
    name: t.name,
    namespaced_name: namespacedName(String(server.key), t.name),
    description: t.description,
    parameters: t.parameters,
    read_only_hint: t.read_only_hint,
  }));

  await store
    .updateMcpServers({
      id: serverId,
      transport: result.transportUsed ?? server.transport,
      tools_cache: cache,
      tools_count: cache.length,
      health: 'ok',
      last_error: null,
      last_connected_at: new Date(),
      last_discovered_at: new Date(),
    })
    .catch(() => {});

  return { ok: true, tools_count: cache.length, transport: result.transportUsed };
}

/**
 * Seam de tools del loop agéntico: descubrimiento + ejecución.
 *
 * Existe por una razón medida: `discoverAllTools` levanta el MCP in-process
 * (`getMcpTools`) y eso deja un handle vivo que impide que el proceso termine.
 * Como el loop descubre tools en CADA paso, sin este seam cualquier test del
 * loop cuelga al runner. Doblarlo mantiene los tests herméticos y rápidos.
 *
 * Es el germen del `ToolRuntime` completo: acá está solo el borde con el
 * registry; el allow-list, la policy y el ruteo a tools nativas siguen en
 * `agent.ts` hasta que se extraigan.
 */
export type ToolRuntime = {
  discover(store: RegistryStore): Promise<UnifiedTool[]>;
  execute(
    store: RegistryStore,
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: string; text: string }> }>;
};

/** La implementación de producción: las dos funciones de este módulo. */
export const defaultToolRuntime: ToolRuntime = {
  discover: discoverAllTools,
  execute: executeUnifiedTool,
};
