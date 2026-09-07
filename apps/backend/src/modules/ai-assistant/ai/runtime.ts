/**
 * Runtime del agente: el CÓMO de las capacidades, separado del CUÁNDO del loop.
 *
 * Junta dos superficies que antes vivían dentro de `agent.ts` y que los tres
 * loops (chat, headless y WhatsApp) usan por igual:
 *
 *  - Tools: descubrimiento, acotado por el allow-list del agente, anotación de
 *    prohibiciones en la descripción, saneo del JSON-schema y ejecución (con el
 *    ruteo a tools nativas).
 *  - Memoria: tipos efectivos por agente y las dos tools sintéticas
 *    (`search_memory` / `remember`) que el loop intercepta.
 *
 * Extraerlas es lo que permite que `runHeadlessAnalysis` viva en su propio
 * módulo sin volver a importar `agent.ts`, que era el último ciclo que quedaba.
 */
import type { ToolRuntime } from './tool-registry';
import { type OpenAiTool } from './chat-client';
import {
  resolveMode,
  SEARCH_MEMORY_TOOL,
  REMEMBER_TOOL,
  type PolicyOverride,
} from './policy';
import {
  embedText,
  retrieveMemories,
  saveMemory,
  DEFAULT_MEMORY_TYPES,
  ALL_MEMORY_TYPES,
  type MemoryType,
} from './memory';
import { toolDescription } from './tool-labels';
import { compactToolResult } from './tool-result';
import { isNativeTool, executeNativeTool, type NativeToolContext } from './native-tools';
import { comboAllowed, scopeFor } from './capabilities';
import type { ToolScope } from './agents';
import type { AiStore, ChatAttachment, ContentPart } from './types';

/** Tope de vueltas del loop agéntico. Los presets pueden pisarlo.  */
export const MAX_STEPS = 8;

/** Nombre del tool sintético de handoff (no es una tool del MCP). */
export const HANDOFF_TOOL_NAME = 'handoff_to_agent';

/** Parseo tolerante de los `arguments` del modelo: nunca tira. */
export function safeParseArgs(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Overrides de ToolPolicy persistidos en DB. */
export async function loadOverrides(store: AiStore): Promise<PolicyOverride[]> {
  const rows = await store.listToolPolicies({}, { take: 1000 });
  return rows.map((r) => ({
    tool_name: r.tool_name,
    action: r.action,
    resource: r.resource ?? '',
    mode: r.mode,
  }));
}

/** Acciones (enum) de una tool del MCP, o ['*'] si no expone `action`. */
export function toolActions(parameters: { properties?: Record<string, any> } | undefined): string[] {
  const enumVals = parameters?.properties?.action?.enum;
  return Array.isArray(enumVals) && enumVals.length > 0 ? enumVals.map(String) : ['*'];
}

/**
 * Resources (enum) de una tool del MCP, o `[null]` si no expone `resource`.
 * `null` significa "esta tool no tiene granularidad por resource" (resource '').
 */
export function toolResources(
  parameters: { properties?: Record<string, any> } | undefined,
): Array<string | null> {
  const enumVals = parameters?.properties?.resource?.enum;
  return Array.isArray(enumVals) && enumVals.length > 0 ? enumVals.map(String) : [null];
}

/**
 * Tool sintético que el agente usa para derivar la conversación. `target` es un
 * enum con las `key` de los agentes a los que puede derivar (de `handoff_targets`).
 * No es una tool del MCP: lo intercepta `runLoop` y lo ejecuta como `auto`.
 */
function buildHandoffTool(targets: string[]): OpenAiTool {
  return {
    type: 'function',
    function: {
      name: HANDOFF_TOOL_NAME,
      description:
        'Derivá la conversación a otro agente especializado cuando la consulta cae fuera de tu dominio. El agente destino continúa el mismo turno con su propio prompt y sus propias tools. Resumí el encargo en `reason`.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            enum: targets,
            description: 'Key del agente destino.',
          },
          reason: {
            type: 'string',
            description: 'Breve contexto o encargo para el agente destino.',
          },
        },
        required: ['target'],
        additionalProperties: false,
      },
    },
  };
}

/**
 * Tool sintético de búsqueda en la memoria de la tienda (solo lectura). Lo
 * intercepta `runLoop` (no va al MCP) y corre como `auto`. Devuelve las memorias
 * relevantes por similitud para que el modelo las use como contexto adicional.
 */
function buildSearchMemoryTool(): OpenAiTool {
  return {
    type: 'function',
    function: {
      name: SEARCH_MEMORY_TOOL,
      description:
        'Buscá en la memoria de la tienda (aprendizajes de negocio, decisiones, reglas comerciales, lineamientos de marca, políticas y documentos cargados) por similitud semántica. Usalo cuando necesites contexto del negocio que no está en los datos en vivo de las otras tools.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Qué querés recordar/buscar, en lenguaje natural.' },
          limit: { type: 'number', description: 'Máximo de memorias a traer (1-10, default 5).' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  };
}

/**
 * Tool sintético para guardar una memoria desde la conversación. Lo intercepta
 * `runLoop` y corre como `auto`. Si el usuario lo pidió EXPLÍCITAMENTE ("recordá
 * esto"), `explicit:true` → la memoria queda `active`; si la propone el agente solo,
 * `explicit:false` → queda `pending` (si la config exige aprobación) para revisarla.
 */
function buildRememberTool(): OpenAiTool {
  return {
    type: 'function',
    function: {
      name: REMEMBER_TOOL,
      description:
        'Guardá en la memoria de la tienda un aprendizaje, decisión, regla o preferencia que convenga recordar a futuro. Solo guardá cosas durables y útiles para operar el negocio; NO guardes ruido conversacional ni datos personales. Si el usuario te lo pidió explícitamente ("recordá esto"), pasá explicit:true.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'El dato a recordar, autocontenido.' },
          title: { type: 'string', description: 'Título corto (si lo omitís, se deriva del contenido).' },
          memory_type: {
            type: 'string',
            enum: ALL_MEMORY_TYPES.filter((t) => t !== 'document_chunk'),
            description: 'Tipo de memoria. Default: conversation_learning.',
          },
          explicit: { type: 'boolean', description: 'true si el usuario pidió recordarlo explícitamente.' },
        },
        required: ['content'],
        additionalProperties: false,
      },
    },
  };
}

/**
 * Construye el array de tools para el modelo: descubre las tools del MCP, las
 * acota por el allow-list del agente (si tiene) y excluye las que tienen TODAS
 * sus acciones prohibidas. Anota en la descripción qué acciones están prohibidas
 * o requieren confirmación, para guiar al modelo. `memoryTools` agrega las tools
 * sintéticas de memoria (search/remember) según la config.
 */
export async function buildToolsForModel(
  store: AiStore,
  toolRt: ToolRuntime,
  overrides: PolicyOverride[],
  allowedTools: ToolScope[] | null = null,
  handoffTargets: string[] = [],
  memoryTools: { search?: boolean; remember?: boolean } = {},
) {
  const rawTools = await toolRt.discover(store);

  const tools: OpenAiTool[] = [];
  for (const t of rawTools) {
    const name = t.definition?.name;
    if (!name) continue;
    // Allow-list del agente: si la tiene, el agente solo ve esas tools.
    const scope = scopeFor({ allow: allowedTools }, name);
    if (!scope) continue;
    const actions = toolActions(t.definition.parameters);
    const resources = toolResources(t.definition.parameters);

    // Producto cartesiano (action × resource). resource === null ⇒ tool sin
    // granularidad por resource (se resuelve con '').
    //
    // El scope del agente acota los combos ADEMÁS de la ToolPolicy global: si
    // declara `actions: ['list']`, el resto queda prohibido para él aunque la
    // policy los deje pasar. Es advisory —el modelo no los ve—; la decisión
    // autoritativa la toma el clasificador del loop con `modeFromProfile`.
    const combos = resources.flatMap((resource) =>
      actions.map((action) => ({
        action,
        resource,
        mode: !comboAllowed(scope, action, resource)
          ? ('prohibited' as const)
          : resolveMode(name, action, resource ?? '', overrides),
      })),
    );

    // La tool se excluye solo si TODOS los combos están prohibidos.
    if (combos.every((c) => c.mode === 'prohibited')) continue;

    const fmt = (c: { action: string; resource: string | null }) =>
      c.resource !== null ? `${c.resource}/${c.action}` : c.action;

    const prohibited = combos.filter((c) => c.mode === 'prohibited');
    const ask = combos.filter((c) => c.mode === 'ask');

    // Una nota se omite si su único item es la acción comodín '*' (tool sin
    // enum de `action`): no hay nada concreto que listar.
    const onlyWildcard = (cs: typeof combos) => cs.length === 1 && cs[0]?.action === '*';

    const notes: string[] = [];
    if (prohibited.length > 0 && !onlyWildcard(prohibited)) {
      notes.push(`Acciones PROHIBIDAS (no las uses): ${prohibited.map(fmt).join(', ')}.`);
    }
    if (ask.length > 0 && !onlyWildcard(ask)) {
      notes.push(
        `Acciones que requieren confirmación del usuario: ${ask.map(fmt).join(', ')}.`,
      );
    }
    const description = [toolDescription(name, t.definition.description), ...notes]
      .filter(Boolean)
      .join(' ');

    tools.push({
      type: 'function',
      function: {
        name,
        description,
        parameters: sanitizeJsonSchema(
          t.definition.parameters ?? { type: 'object', properties: {} },
        ),
      },
    });
  }
  // Tool sintético de handoff: se ofrece solo si el agente declara destinos. Lo
  // intercepta `runLoop` (no se manda al MCP) y se ejecuta como `auto`.
  if (handoffTargets.length > 0) {
    tools.push(buildHandoffTool(handoffTargets));
  }
  // Tools sintéticas de memoria (también interceptadas en `runLoop`).
  if (memoryTools.search) tools.push(buildSearchMemoryTool());
  if (memoryTools.remember) tools.push(buildRememberTool());
  return tools;
}

/** Tipos efectivos que recupera un agente: sus `memoryTypes` (o el default) +
 * siempre `document_chunk` (el contexto que tiene cargado). */
export function effectiveMemoryTypes(agentMemoryTypes: string[] | null): string[] {
  const base = agentMemoryTypes ?? DEFAULT_MEMORY_TYPES;
  return Array.from(new Set([...base, 'document_chunk']));
}

/**
 * Ejecuta el tool sintético `search_memory`: embebe la query, recupera memorias y
 * devuelve el texto para el modelo + los ids (para auditoría/uso). Best-effort.
 */
export async function runSearchMemoryTool(
  store: AiStore,
  args: Record<string, unknown>,
  ctx: { tenantId: string; agentKey: string | null; memoryTypes: string[]; minSimilarity: number },
): Promise<{ text: string; ids: string[] }> {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!query) return { text: 'Para buscar en memoria necesito un texto en "query".', ids: [] };
  let embedding: number[] | null = null;
  try {
    embedding = await embedText(query);
  } catch {
    embedding = null;
  }
  if (!embedding) return { text: 'No pude buscar en la memoria en este momento.', ids: [] };
  const limit =
    typeof args.limit === 'number' && Number.isFinite(args.limit)
      ? Math.min(Math.max(Math.round(args.limit), 1), 10)
      : 5;
  const results = await retrieveMemories(store, {
    tenantId: ctx.tenantId,
    agentKey: ctx.agentKey,
    memoryTypes: ctx.memoryTypes,
    queryEmbedding: embedding,
    topK: limit,
    minSimilarity: ctx.minSimilarity,
  });
  if (results.length === 0) return { text: 'No encontré memorias relevantes para esa búsqueda.', ids: [] };
  const text = results.map((r, i) => `${i + 1}. ${r.text}`).join('\n');
  return { text, ids: results.map((r) => r.id) };
}

/** Ejecuta el tool sintético `remember`: guarda una memoria desde la conversación. */
export async function runRememberTool(
  store: AiStore,
  args: Record<string, unknown>,
  ctx: {
    tenantId: string;
    agentKey: string | null;
    threadId: string;
    requiresApproval: boolean;
    createdBy?: string | null;
  },
): Promise<{ text: string }> {
  const content = typeof args.content === 'string' ? args.content.trim() : '';
  if (!content) return { text: 'No guardé nada: faltó el contenido a recordar.' };
  const title =
    typeof args.title === 'string' && args.title.trim()
      ? args.title.trim().slice(0, 120)
      : content.slice(0, 80);
  const requestedType = typeof args.memory_type === 'string' ? args.memory_type : '';
  const memoryType: MemoryType = (ALL_MEMORY_TYPES as readonly string[]).includes(requestedType)
    ? (requestedType as MemoryType)
    : 'conversation_learning';
  const explicit = args.explicit === true;
  const status = explicit ? 'active' : ctx.requiresApproval ? 'pending' : 'active';
  const row = await saveMemory(store, {
    tenantId: ctx.tenantId,
    agentKey: ctx.agentKey,
    memoryType,
    title,
    content,
    source: 'conversation',
    sourceRefId: ctx.threadId,
    status,
    createdBy: ctx.createdBy ?? null,
    confidenceScore: explicit ? 80 : 60,
  });
  if (!row) return { text: 'No pude guardar la memoria en este momento.' };
  return {
    text:
      status === 'pending'
        ? 'Lo anoté para revisión: queda pendiente de aprobación en la pestaña Memoria antes de usarse.'
        : 'Listo, lo guardé en la memoria de la tienda.',
  };
}

/**
 * Sanea un JSON Schema para function-calling de OpenAI/OpenRouter: elimina las
 * propiedades cuyo nombre empieza con `$` (ej. los operadores de filtro de fecha
 * `$gte`/`$lte` que trae el MCP), porque el validador de tools de OpenAI rechaza
 * esos nombres y tira 400 (la respuesta queda vacía). Donde había `$`-keys deja
 * `additionalProperties: true`, así el modelo igual puede pasar el objeto
 * `{ "$gte": "..." }` (guiado por la descripción del parámetro).
 */
function sanitizeJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(sanitizeJsonSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === 'properties' && value && typeof value === 'object') {
      const props: Record<string, unknown> = {};
      let hadDollar = false;
      for (const [pk, pv] of Object.entries(value as Record<string, unknown>)) {
        if (pk.startsWith('$')) {
          hadDollar = true;
          continue;
        }
        props[pk] = sanitizeJsonSchema(pv);
      }
      if (Object.keys(props).length > 0) out.properties = props;
      if (hadDollar && out.additionalProperties === undefined) out.additionalProperties = true;
    } else {
      out[key] = sanitizeJsonSchema(value);
    }
  }
  return out;
}

export async function execTool(
  store: AiStore,
  toolRt: ToolRuntime,
  name: string,
  args: Record<string, unknown>,
  ctx?: NativeToolContext,
): Promise<string> {
  // Tools nativas (in-process): no van al MCP, se ejecutan acá con el container.
  if (isNativeTool(name)) {
    return executeNativeTool(name, args, ctx);
  }
  try {
    const res = await toolRt.execute(store, name, args);
    const text = res?.content?.[0]?.text ?? JSON.stringify(res);
    return compactToolResult(text);
  } catch (e) {
    const err = e as { message?: string; status?: number };
    const msg = err.message ?? String(e);
    // Un 401/403 acá NO es problema del modelo ni de la consulta: las tools
    // in-process no pudieron autenticarse (401) o la credencial no tiene permiso
    // sobre ese recurso (403). Los dos se devuelven como problema de
    // configuración para que el asistente lo explique en vez de tirar un
    // "Forbidden" críptico.
    //
    // El 403 estaba faltando y el síntoma era peor que críptico: caía en el hint
    // genérico de auto-corrección de más abajo ("revisá los parámetros y
    // reintentá con otra variante"), así que el modelo quemaba pasos probando
    // filtros distintos contra una API que nunca le iba a contestar, y al usuario
    // le ofrecía "buscar por categoría" cuando el problema era la credencial.
    const authStatus = err.status === 401 || /\b401\b|unauthorized/i.test(msg) ? 401 : null;
    const forbidden = err.status === 403 || /\b403\b|forbidden/i.test(msg);
    if (authStatus || forbidden) {
      const detalle = authStatus
        ? 'no tienen credenciales válidas (401)'
        : 'tienen credenciales válidas pero SIN permiso sobre ese recurso (403)';
      return `Error de acceso a la Admin API de Medusa: las tools del asistente ${detalle}. Revisá MEDUSA_API_KEY / MEDUSA_AUTH_TYPE / MEDUSA_BASE_URL y los permisos del usuario/API key en el backend. Decile al usuario que es un problema de configuración del servidor, NO de la consulta: no sirve reintentar con otros filtros ni con otra categoría.`;
    }
    // Error reintentable: dale al modelo una pista accionable para que ajuste los
    // parámetros y reintente UNA variante distinta (no la misma llamada), o desista
    // y se lo explique al usuario. Es el "error feedback" del loop self-correcting.
    return `Error ejecutando ${name}: ${msg}. Revisá los parámetros (filtros, limit, fechas) y reintentá con UNA variante distinta; si vuelve a fallar, explicáselo al usuario en vez de repetir la misma llamada.`;
  }
}

// ── Contenido multimodal ─────────────────────────────────────────────────────

/** Tope de caracteres del texto de un documento adjunto (no inflar el prompt). */
const MAX_DOC_CHARS = 12000;

/**
 * URL de una imagen adjunta lista para mandar al modelo. En producción (S3/URL
 * pública) se pasa la URL tal cual (OpenRouter la baja). En dev el archivo vive en
 * el disco local del backend (`/static/...`, host no accesible desde OpenRouter),
 * así que la bajamos y la mandamos inline como data URI para que la visión funcione.
 */
async function imageUrlForLlm(url: string): Promise<string> {
  const isLocal = url.startsWith('/') || /localhost|127\.0\.0\.1|0\.0\.0\.0|\/static\//.test(url);
  if (!isLocal) return url;
  try {
    const abs = url.startsWith('http')
      ? url
      : `${(process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000').replace(/\/$/, '')}${
          url.startsWith('/') ? '' : '/'
        }${url}`;
    const res = await fetch(abs);
    if (!res.ok) return url;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type') || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return url;
  }
}

/**
 * `content` de un mensaje `user`: si tiene imágenes adjuntas pasa a ser un array de
 * partes (texto + image_url) para visión; los documentos adjuntos suman su texto
 * extraído como contexto. Sin adjuntos, es el string de siempre. Lo usan tanto el
 * loop del chat (historial persistido) como los subagentes headless (que reciben
 * las imágenes del mensaje disparador como contexto).
 */
export async function userContent(
  text: string | null,
  attachments?: ChatAttachment[] | null,
): Promise<string | ContentPart[]> {
  const atts = Array.isArray(attachments) ? attachments : [];
  const docBlocks = atts
    .filter((a) => a.kind === 'document' && a.text && a.text.trim())
    .map((a) => `\n\n[Documento adjunto: ${a.filename}]\n${(a.text as string).slice(0, MAX_DOC_CHARS)}`)
    .join('');
  const fullText = `${text ?? ''}${docBlocks}`;
  const images = atts.filter((a) => a.kind === 'image');
  if (images.length === 0) return fullText;
  const parts: ContentPart[] = [];
  if (fullText.trim()) parts.push({ type: 'text', text: fullText });
  for (const img of images) {
    parts.push({ type: 'image_url', image_url: { url: await imageUrlForLlm(img.url) } });
  }
  return parts;
}
