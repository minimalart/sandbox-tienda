import type { ProposedAction } from './types';

/**
 * Propuesta parseada del output del analista (bloques `<proposal>{json}</proposal>`).
 * El job/route las persiste como filas `ai_proposal`.
 */
export type ParsedProposal = {
  title: string;
  summary: string;
  rationale?: string;
  proposed_actions: ProposedAction[];
  expected_impact?: Record<string, unknown> | null;
};

/**
 * Instrucción para el analista headless: qué analizar y CÓMO devolver las
 * propuestas (bloques `<proposal>` con JSON). No ejecuta escrituras: las propone.
 * El playbook cubre TODO el repertorio: acciones comerciales (promos, precios,
 * stock, bundles), de contenido/marketing (blog, banner, landing, campaña
 * completa) y de segmentación (grupos dinámicos).
 */
export function buildAnalysisTask(opts?: { limit?: number; focus?: string }): string {
  const limit = opts?.limit ?? 3;
  const focus = opts?.focus?.trim();
  return [
    `Tarea de análisis proactivo. Detectá hasta ${limit} oportunidades o problemas ACCIONABLES del negocio y proponé la acción concreta que los resuelve. NO ejecutes las escrituras vos: PROPONELAS (un humano aprueba y ahí se ejecutan).`,
    focus ? `Foco de este análisis: ${focus}.` : '',
    'MÉTODO: arrancá SIEMPRE con las tools de analytics `analyze_sales`, `analyze_products` y/o `analyze_customers` (1-3 llamadas: te dan KPIs con comparación de períodos, top/slow movers, stock, clientes en riesgo y grupos existentes). Después profundizá SOLO donde hay señal, con lecturas puntuales del MCP para conseguir los IDs, precios y monedas REALES que necesitás para armar los `args`.',
    'PLAYBOOK — tipos de propuesta (elegí el que mejor resuelve cada hallazgo):',
    '- (a) PROMOCIÓN con la tool nativa `prepare_promotion`: {"tool":"prepare_promotion","args":{"type":"bogo|combo|free_shipping|percentage|fixed","product_ids":["prod_..."],"value":<solo percentage/fixed>,"name":"...","customer_group_ids":["..."] (opcional)}}. Al aprobar se crea INACTIVA y una persona la activa. Preferí bogo/combo/free_shipping antes que un porcentaje seco.',
    '- (b) PRICE LIST de temporada o segmento (`manage_medusa_admin_pricing`, action create): `args` debe llevar SIEMPRE `title` (corto), `description` (1 oración), `status`:"active", `type`:"sale" y `prices`:[{"variant_id":"...","currency_code":"<la moneda REAL que viste, ej. ars/usd>","amount":<número>}]. Nunca omitas `title`, `description` ni `currency_code`.',
    '- (c) AJUSTE DE PRECIO, también HACIA ARRIBA: producto que vende muy por encima de su categoría o desalineado vs su colección (update de precios con valores reales).',
    '- (d) COLECCIÓN / BUNDLE (`manage_medusa_admin_collections` create + product_ids reales): curaduría de productos que se venden juntos o comparten temporada.',
    '- (e) REPOSICIÓN DE STOCK (`manage_medusa_admin_inventory`, update del stock level usando el `inventory_item_id` y `location_id` que te devuelve `analyze_products`): SOLO para productos con ventas y stock bajo/quiebre.',
    '- (f) VISIBILIDAD / HIGIENE COMERCIAL (`manage_medusa_admin_products` update): producto que vende pero está sin categoría/colección o fuera del canal. Solo si impacta ventas.',
    '- (g) WIN-BACK / SEGMENTO: promo o price list dirigida a un customer group EXISTENTE (los lista `analyze_customers`); si el grupo ideal no existe, encadenala con (l). Para un cliente VIP puntual: `issue_gift_card` {"value":...,"currency_code":"...","customer_id":"cus_..."}.',
    '- (h) NOTA DE BLOG con la tool nativa `create_blog_post` (crea un BORRADOR; nunca publica): contenido que empuje productos con señal (top sellers, temporada, búsqueda). Pasá `product_ids` para linkear productos.',
    '- (i) BANNER con la tool nativa `create_banner_draft`: {"tool":"create_banner_draft","args":{"internal_name":"...","title":"...","subtitle":"...","cta_label":"...","cta_url":"/...","image_prompt":"descripción visual en inglés, sin texto en la imagen","alt":"..."}}. Queda en BORRADOR con imagen generada; una persona lo publica.',
    '- (j) LANDING con la tool nativa `create_landing_draft`: {"tool":"create_landing_draft","args":{"title":"...","slug":"minusculas-con-guiones","seo_title":"...","seo_description":"...","campaign_name":"...","product_ids":["prod_..."]}}. Queda en BORRADOR con contenido compuesto; una persona la publica.',
    '- (k) CAMPAÑA COMERCIAL COMPLETA con la tool nativa `start_workflow`: {"tool":"start_workflow","args":{"workflow_key":"campania_comercial","input":{...brief con nombre, objetivo, productos/categorías y tipo de promo...}}}. Usala cuando la oportunidad amerita promo + banner + landing + nota coordinados (p. ej. una fecha comercial fuerte).',
    '- (l) GRUPO DINÁMICO de clientes con la tool nativa `create_dynamic_group`: {"tool":"create_dynamic_group","args":{"name":"...","match":"all|any","conditions":[{"field":"total_spend|orders_count|days_since_last_order|aov|spend_last_days|registered_no_purchase|account_age_days|birthday_this_month","operator":"gte|lte|eq","value":...}]}}. Al aprobar se crea Y se puebla en el momento; podés encadenar una promo dirigida con "customer_group_ids":["$prev.customer_group_id"].',
    '- (m) CICLO DE VIDA DE PROMOS (verificá con `analyze_promotions`): pausar/terminar una promo activa SIN uso (`manage_medusa_admin_pricing` update con `status`:"inactive") o extender/replicar la que funciona.',
    '- (n) FIDELIZACIÓN (verificá con `analyze_loyalty`; SOLO si hay programa activo): campaña de puntos `create_loyalty_campaign` {"name":"...","multiplier":2,"starts_at":"YYYY-MM-DD","ends_at":"YYYY-MM-DD"} o reward `create_loyalty_reward` {"name":"...","cost_points":...,"type":"percent_discount|fixed_discount|free_shipping|store_credit","value":...}.',
    '- (o) RECUPERACIÓN DE CARRITOS (verificá con `analyze_carts`): incentivo concreto (envío gratis / descuento acotado / gift card) sobre los carritos abandonados de mayor valor.',
    '- (p) GAP DE BÚSQUEDA (verificá con `analyze_search_gaps`): término buscado sin resultados → renombrar/re-taggear el producto existente, o propuesta asesora para sumarlo al catálogo.',
    '- (q) ASESORA (`"actions":[]`): SOLO si de verdad ninguna tool puede hacer el cambio; se implementa a mano.',
    'Devolvé EXACTAMENTE un bloque por hallazgo (JSON válido en UNA línea), sin texto fuera de los bloques:',
    '<proposal>{"title":"...","summary":"1-2 oraciones con la recomendación","rationale":"diagnóstico + evidencia citando las cifras reales que obtuviste","actions":[{"tool":"<nombre EXACTO del tool>","args":{...},"label":"texto humano de la acción"}],"expected_impact":{"metric":"...","estimate":"..."}}</proposal>',
    'Reglas:',
    '- DIVERSIDAD: el descuento NO es la respuesta por defecto. Máximo UNA propuesta de descuento puro (percentage/fixed o price list de rebaja) por corrida; las demás deben ser de tipos DISTINTOS del playbook (stock, bundle, contenido, segmento, precio hacia arriba, operativa...).',
    '- CAMPOS COMPLETOS EN CREATE: incluí TODOS los campos requeridos por el schema del tool, con IDs y valores REALES que obtuviste en las lecturas (la acción se ejecuta una sola vez: si faltan campos, falla y no se reintenta). Mejor una acción bien armada que muchas a medias.',
    '- ACCIONES EN SERIE CON PIPING: una acción puede usar valores del resultado de la acción ANTERIOR con "$prev.<clave>" (p. ej. "$prev.customer_group_id" tras `create_dynamic_group`); si una acción falla, la cadena se corta. Usá cadenas solo cuando hace falta (segmento→promo, colección→promo); si no, UNA acción por propuesta.',
    '- title corto y accionable; summary y rationale en español, concretos y con números REALES (nunca inventes).',
    '- Si no hay nada accionable, respondé solo "Sin propuestas." sin ningún bloque.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Agentes EXCLUIDOS del fan-out de propuestas: subagentes mecánicos de workflow
 * (`promociones`, `validador`) y el bot de atención (`whatsapp`). No son
 * analistas de dominio; correrlos genera ruido. Es una deny-list (y no una
 * allow-list) a propósito: los agentes `custom` creados en el backoffice SÍ
 * participan.
 */
export const PROPOSAL_EXCLUDED_AGENT_KEYS: ReadonlySet<string> = new Set([
  'promociones',
  'validador',
  'whatsapp',
]);

/**
 * Foco de análisis por agente (se inyecta en la tarea): cada especialista mira
 * su dominio y no pisa a los demás.
 */
export const PROPOSAL_AGENT_FOCUS: Record<string, string> = {
  ventas:
    'performance comercial — tendencia de ventas y ticket promedio, clientes VIP y en riesgo (win-back sobre grupos existentes), oportunidades de promoción 2x1/combo/envío gratis y campañas comerciales completas para fechas fuertes',
  catalogo:
    'catálogo — productos sin rotación, stock bajo y quiebres, precios desalineados (hacia abajo Y hacia arriba), bundles/colecciones, y productos que venden pero están mal categorizados o fuera de canal',
  ordenes:
    'operaciones — demoras de fulfillment, pagos sin capturar, devoluciones recurrentes y órdenes borrador olvidadas',
  redactor:
    'contenido — notas de blog y landings que empujen productos con señal real (top sellers, temporada, clientes que buscan algo), siempre como borradores linkeando product_ids',
  imagenes:
    'visual — banners en borrador para picos de demanda, promos vigentes o fechas comerciales próximas',
  investigador:
    'mercado — tendencias y fechas comerciales próximas que crucen con el catálogo (propuestas de campaña o contenido con evidencia del negocio)',
};

/** Fila mínima de `ai_agent` para resolver sobre qué agentes generar propuestas. */
export type ProposalAgentRow = { key: string; enabled?: boolean; is_orchestrator?: boolean };

/**
 * Resuelve sobre qué agentes correr el análisis proactivo (fan-out): cada agente
 * ESPECIALIZADO/custom habilitado (no-orquestador) propone en su dominio, y cada
 * propuesta queda atribuida a su `agent_key`. Si no hay especialistas, cae al
 * orquestador habilitado y, en última instancia, al `fallbackKey` (p. ej. cuando
 * todavía no hay agentes sembrados).
 */
export function resolveProposalAgentKeys(
  agentRows: ProposalAgentRow[],
  fallbackKey: string,
): string[] {
  const enabled = (agentRows ?? []).filter((a) => a && a.enabled !== false && a.key);
  const specialists = enabled
    .filter((a) => !a.is_orchestrator && !PROPOSAL_EXCLUDED_AGENT_KEYS.has(a.key))
    .map((a) => a.key);
  if (specialists.length > 0) return [...new Set(specialists)];
  const orchestrator = enabled.find((a) => a.is_orchestrator)?.key;
  return [orchestrator ?? fallbackKey];
}

// ---------------------------------------------------------------------------
// Piping entre acciones ("$prev.<path>"): una acción puede usar valores del
// resultado de la acción ANTERIOR (p. ej. crear un grupo dinámico y después una
// promo dirigida a su customer_group_id). Los resultados de tools son TEXTO,
// así que primero se extrae lo estructurado (JSON, bloque <result> o pares
// clave=valor de los mensajes "OK: ... banner_id=...").
// ---------------------------------------------------------------------------

const RESULT_BLOCK_RE = /<result>([\s\S]*?)<\/result>/i;
const KV_PAIR_RE = /([A-Za-z_][A-Za-z0-9_]*)=([^\s|,;]+)/g;

/** Extrae un objeto estructurado del texto que devuelve una tool (best-effort). */
export function extractActionResult(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!text) return out;
  // 1) Pares clave=valor de los mensajes humanos ("banner_id=... | slug=...").
  for (const m of text.matchAll(KV_PAIR_RE)) {
    const key = m[1];
    const value = m[2];
    if (key && value !== undefined) out[key] = value.replace(/[.,;)]+$/, '');
  }
  // 2) Bloque <result>{json}</result> (tools nativas).
  const block = text.match(RESULT_BLOCK_RE)?.[1];
  if (block) {
    try {
      const parsed = JSON.parse(block.trim());
      if (parsed && typeof parsed === 'object') Object.assign(out, parsed);
    } catch {
      // se ignora
    }
  }
  // 3) El texto entero como JSON (respuestas del MCP).
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) Object.assign(out, parsed);
  } catch {
    // se ignora
  }
  return out;
}

function getPath(obj: unknown, path: string): unknown {
  let cur: any = obj;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    const idx = /^\d+$/.test(part) ? Number(part) : part;
    cur = cur[idx as any];
  }
  return cur;
}

const PREV_REF_RE = /^\$prev\.([A-Za-z0-9_.[\]-]+)$/;

/**
 * Resuelve las referencias "$prev.<path>" de los args contra el resultado de la
 * acción anterior. Devuelve los args resueltos o un error (path inexistente /
 * sin acción previa) para cortar la cadena con un mensaje claro.
 */
export function resolvePipedArgs(
  args: Record<string, unknown>,
  prevResult: Record<string, unknown> | null,
): { args: Record<string, unknown>; error?: string } {
  let error: string | undefined;
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const m = value.match(PREV_REF_RE);
      if (!m) return value;
      const path = m[1] as string;
      if (!prevResult) {
        error = error ?? `la acción usa "$prev.${path}" pero no hay resultado de una acción anterior`;
        return value;
      }
      const resolved = getPath(prevResult, path);
      if (resolved === undefined || resolved === null) {
        error = error ?? `no se encontró "${path}" en el resultado de la acción anterior`;
        return value;
      }
      return resolved;
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = walk(v);
      return out;
    }
    return value;
  };
  const resolved = walk(args) as Record<string, unknown>;
  return error ? { args, error } : { args: resolved };
}

const PROPOSAL_RE = /<proposal>([\s\S]*?)<\/proposal>/gi;

/** Extrae y valida los bloques `<proposal>{json}</proposal>` del texto del analista. */
export function parseProposals(text: string): ParsedProposal[] {
  const out: ParsedProposal[] = [];
  if (!text) return out;
  for (const m of text.matchAll(PROPOSAL_RE)) {
    const raw = (m[1] ?? '').trim();
    if (!raw) continue;
    let obj: any;
    try {
      obj = JSON.parse(raw);
    } catch {
      continue; // bloque mal formado: se ignora
    }
    if (!obj || typeof obj !== 'object') continue;
    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
    if (!title || !summary) continue;
    const proposed_actions: ProposedAction[] = Array.isArray(obj.actions)
      ? obj.actions
          .filter((a: any) => a && typeof a.tool === 'string')
          .map((a: any) => ({
            tool: a.tool,
            args: a.args && typeof a.args === 'object' ? a.args : {},
            label: typeof a.label === 'string' ? a.label : undefined,
          }))
      : [];
    out.push({
      title,
      summary,
      rationale: typeof obj.rationale === 'string' ? obj.rationale : undefined,
      proposed_actions,
      expected_impact:
        obj.expected_impact && typeof obj.expected_impact === 'object'
          ? obj.expected_impact
          : null,
    });
  }
  return out;
}
