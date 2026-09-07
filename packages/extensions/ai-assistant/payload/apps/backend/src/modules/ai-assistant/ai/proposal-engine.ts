import type { MedusaContainer } from '@medusajs/framework/types';
import { getAiAssistantSettings } from '../settings';
import { chatComplete } from './chat-client';
import type { ApiMessage } from './types';
import { runHeadlessAnalysis } from './headless';
import type { AiStore, MemoryRuntimeOptions } from './types';
import {
  buildAnalysisTask,
  parseProposals,
  resolveProposalAgentKeys,
  PROPOSAL_AGENT_FOCUS,
  type ParsedProposal,
} from './proposals';
import {
  collectSalesSnapshot,
  collectProductSignals,
  collectCustomerSignals,
  collectPromotionSignals,
  collectCartSignals,
  collectSearchGapSignals,
  collectLoyaltySignals,
} from './native-tools/analytics-tools';

/**
 * Motor de propuestas por SUBAGENTES: detector (determinístico) → triage (1
 * llamada LLM liviana) → especialistas por tipo (headless en paralelo). Cada
 * especialista arranca con la evidencia de su lead y produce EXACTAMENTE una
 * propuesta bien armada, en vez de un generalista que estira sus pasos entre
 * todos los frentes. El motor "Simple" —"Motor de análisis" en la card del
 * Asistente IA, o `AI_PROPOSALS_ENGINE=simple` en el entorno— vuelve al fan-out
 * por agente, que también es el fallback automático si el triage falla o no da
 * leads.
 */

export type ProposalLeadType =
  | 'promo'
  | 'pricing'
  | 'inventory'
  | 'bundle'
  | 'winback'
  | 'ops'
  | 'blog'
  | 'banner'
  | 'landing'
  | 'campaign'
  | 'dynamic_group'
  | 'promo_lifecycle'
  | 'cart_recovery'
  | 'search_gap'
  | 'loyalty';

export type ProposalLead = {
  type: ProposalLeadType;
  /** Evidencia CONCRETA del digest (cifras, IDs, nombres) que justifica el lead. */
  evidence: string;
  /** Encargo puntual para el especialista (qué resolver). */
  focus: string;
};

/** Atribución: el especialista corre con el agente "dueño" del dominio (para la UI). */
export const LEAD_AGENT_KEYS: Record<ProposalLeadType, string> = {
  promo: 'ventas',
  winback: 'ventas',
  campaign: 'ventas',
  dynamic_group: 'ventas',
  promo_lifecycle: 'ventas',
  cart_recovery: 'ventas',
  loyalty: 'ventas',
  pricing: 'catalogo',
  inventory: 'catalogo',
  bundle: 'catalogo',
  search_gap: 'catalogo',
  ops: 'ordenes',
  blog: 'redactor',
  landing: 'redactor',
  banner: 'imagenes',
};

export const PROPOSAL_LEAD_TYPES = Object.keys(LEAD_AGENT_KEYS) as ProposalLeadType[];

const PROPOSAL_FORMAT = [
  'Devolvé EXACTAMENTE UN bloque <proposal>{json}</proposal> (JSON válido en UNA línea), sin texto fuera del bloque:',
  '<proposal>{"title":"...","summary":"1-2 oraciones con la recomendación","rationale":"diagnóstico + evidencia citando las cifras reales","actions":[{"tool":"<nombre EXACTO del tool>","args":{...},"label":"texto humano de la acción"}],"expected_impact":{"metric":"...","estimate":"..."}}</proposal>',
  'Reglas: completá `args` con TODOS los campos requeridos por el schema del tool, usando IDs/precios/monedas REALES que verifiques con lecturas puntuales (la acción se ejecuta una sola vez; si faltan campos falla y no se reintenta). Las acciones se ejecutan EN SERIE y una acción puede usar valores del resultado de la ANTERIOR con la forma "$prev.<clave>" (p. ej. "$prev.customer_group_id"); si una falla, la cadena se corta. Usá cadenas SOLO cuando el template lo indique; si no, UNA acción por propuesta. title corto y accionable; summary y rationale en español con números reales. Si el lead no se sostiene con los datos, respondé solo "Sin propuestas.".',
].join('\n');

/** Tarea del especialista por tipo de lead (instrucciones + template de args). */
export function buildSpecialistTask(lead: ProposalLead): string {
  const templates: Record<ProposalLeadType, string> = {
    promo: `Armá UNA propuesta de PROMOCIÓN con la tool nativa \`prepare_promotion\`: {"tool":"prepare_promotion","args":{"type":"bogo|combo|free_shipping|percentage|fixed","product_ids":["prod_..."],"value":<solo percentage/fixed>,"name":"...","customer_group_ids":["..."] (opcional)}}. Al aprobar se crea INACTIVA y una persona la activa. Preferí bogo/combo/free_shipping antes que un porcentaje seco. Verificá los product_ids con la tool de productos.`,
    pricing: `Armá UNA propuesta de AJUSTE DE PRECIO o PRICE LIST. Para un price list (\`manage_medusa_admin_pricing\`, action create): \`title\` corto, \`description\` (1 oración), \`status\`:"active", \`type\`:"sale" y \`prices\`:[{"variant_id":"...","currency_code":"<moneda REAL>","amount":<número>}]. También vale proponer subir un precio desalineado hacia ARRIBA. Verificá variant_ids, moneda y precio actual con lecturas.`,
    inventory: `Armá UNA propuesta de REPOSICIÓN DE STOCK (\`manage_medusa_admin_inventory\`, update del stock level) usando los \`inventory_item_id\` y \`location_id\` REALES de la evidencia (o verificalos con \`analyze_products\`). SOLO para productos que venden y están en quiebre o stock bajo.`,
    bundle: `Armá UNA propuesta de COLECCIÓN/BUNDLE (\`manage_medusa_admin_collections\`, action create) con \`title\`, \`handle\` y los product_ids REALES de productos que se venden juntos o comparten temporada. Verificá los IDs con la tool de productos.`,
    winback: `Armá UNA propuesta de WIN-BACK. Opción 1 (grupo existente): promoción dirigida (\`prepare_promotion\` con \`customer_group_ids\`) a un customer group EXISTENTE (verificalos con \`analyze_customers\`). Opción 2 (grupo nuevo, CADENA de 2 acciones): primero \`create_dynamic_group\` (segmento por comportamiento, p. ej. days_since_last_order gte 60) y después \`prepare_promotion\` con "customer_group_ids":["$prev.customer_group_id"]. Opción 3 (cliente VIP puntual): \`issue_gift_card\` {"value":...,"currency_code":"...","customer_id":"cus_..."} como gesto de recuperación.`,
    ops: `Armá UNA propuesta OPERATIVA sobre órdenes: pagos sin capturar, fulfillments demorados, devoluciones recurrentes u órdenes borrador olvidadas. Usá las tools de órdenes/pagos para verificar los casos y proponé la acción concreta (capturar pago, completar orden, etc.) con IDs reales. Si la acción no existe como tool, propuesta asesora con el detalle exacto.`,
    blog: `Armá UNA propuesta de NOTA DE BLOG con la tool nativa \`create_blog_post\` (crea un BORRADOR; nunca publica): {"tool":"create_blog_post","args":{"title":"...","excerpt":"...","content_html":"<h2>...</h2><p>...</p>... (artículo COMPLETO, no un stub)","product_ids":["prod_..."],"seo_title":"...","seo_description":"..."}}. El contenido debe empujar los productos de la evidencia (verificá los product_ids).`,
    banner: `Armá UNA propuesta de BANNER con la tool nativa \`create_banner_draft\`: {"tool":"create_banner_draft","args":{"internal_name":"...","title":"...","subtitle":"...","cta_label":"...","cta_url":"/collections/... o /landing/...","image_prompt":"descripción visual detallada en inglés, sin texto en la imagen","alt":"..."}}. Queda en BORRADOR con imagen generada; una persona lo publica.`,
    landing: `Armá UNA propuesta de LANDING con la tool nativa \`create_landing_draft\`: {"tool":"create_landing_draft","args":{"title":"...","slug":"minusculas-con-guiones","description":"...","seo_title":"...","seo_description":"...","campaign_name":"...","product_ids":["prod_..."]}}. Queda en BORRADOR con contenido compuesto; una persona la publica.`,
    campaign: `Armá UNA propuesta de CAMPAÑA COMERCIAL COMPLETA con la tool nativa \`start_workflow\`: {"tool":"start_workflow","args":{"workflow_key":"campania_comercial","input":{"campaign":{"name":"...","objective":["vender_mas"],"start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD"},"deliverables":{"blog_post":true,"banner":true,"promotion":true,"landing":true},"product_selection":{"mode":"manual","product_ids":["prod_..."]},"promotion":{"type":"percentage|bogo|combo|free_shipping","value":<si aplica>}}}}. Usala SOLO si la oportunidad amerita promo + banner + landing + nota coordinados (p. ej. fecha comercial fuerte). Verificá los product_ids.`,
    dynamic_group: `Armá UNA propuesta de GRUPO DINÁMICO con la tool nativa \`create_dynamic_group\`: {"tool":"create_dynamic_group","args":{"name":"...","match":"all|any","conditions":[{"field":"total_spend|orders_count|days_since_last_order|aov|spend_last_days|registered_no_purchase|account_age_days|birthday_this_month","operator":"gte|lte|eq","value":...}]}}. Al aprobar se crea Y se puebla en el momento. Basá las condiciones en cifras de la evidencia. Si el segmento amerita un incentivo, podés encadenar una 2.ª acción \`prepare_promotion\` con "customer_group_ids":["$prev.customer_group_id"].`,
    promo_lifecycle: `Armá UNA propuesta de CICLO DE VIDA DE PROMOCIONES: verificá con \`analyze_promotions\` la performance real y proponé pausar/terminar una promo activa SIN uso (\`manage_medusa_admin_pricing\`, action update de la promoción con \`status\`:"inactive") o extender/replicar la que funciona (update de fechas de campaña o \`prepare_promotion\` similar sobre otros productos). Citá el uso real (órdenes y descuento otorgado) en el rationale.`,
    cart_recovery: `Armá UNA propuesta de RECUPERACIÓN DE CARRITOS: verificá con \`analyze_carts\` el valor recuperable y proponé un incentivo concreto: \`prepare_promotion\` (envío gratis o descuento chico acotado a productos de los carritos top) o \`issue_gift_card\` para un cliente identificado de alto valor. La extensión de carritos ya manda recordatorios: tu propuesta agrega el INCENTIVO.`,
    search_gap: `Armá UNA propuesta a partir de BÚSQUEDAS SIN RESULTADOS (verificalas con \`analyze_search_gaps\`): si el producto EXISTE mal nombrado/tageado → \`manage_medusa_admin_products\` update (título/tags/categoría) para que se encuentre; si hay demanda de varios términos afines → colección o landing (\`create_landing_draft\`); si el producto NO existe → propuesta asesora recomendando sumarlo (con las cifras de demanda).`,
    loyalty: `Armá UNA propuesta de FIDELIZACIÓN (verificá el programa con \`analyze_loyalty\`): campaña de puntos con \`create_loyalty_campaign\` {"name":"...","multiplier":2,"starts_at":"YYYY-MM-DD","ends_at":"YYYY-MM-DD"} (puntos dobles/triples con vigencia) o un reward canjeable con \`create_loyalty_reward\` {"name":"...","cost_points":...,"type":"percent_discount|fixed_discount|free_shipping|store_credit","value":...}. Si NO hay programa activo, propuesta asesora recomendando activarlo.`,
  };
  return [
    `Sos un especialista en propuestas de negocio. Encargo: ${lead.focus}`,
    `Evidencia detectada (cifras reales del negocio): ${lead.evidence}`,
    templates[lead.type],
    PROPOSAL_FORMAT,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Detección + triage
// ---------------------------------------------------------------------------

/** Junta las señales del negocio SIN LLM (colectores de analytics, best-effort).
 * Los módulos opcionales (promos/carritos/búsquedas/fidelización) aportan su
 * señal solo si están instalados; si no, la clave simplemente no aparece. */
export async function collectSignals(container: MedusaContainer): Promise<Record<string, unknown>> {
  const [sales, products, customers, promotions, carts, searchGaps, loyalty] =
    await Promise.allSettled([
      collectSalesSnapshot(container, { days: 30 }),
      collectProductSignals(container, { days: 30 }),
      collectCustomerSignals(container, { days: 90 }),
      collectPromotionSignals(container, { days: 30 }),
      collectCartSignals(container),
      collectSearchGapSignals(container),
      collectLoyaltySignals(container),
    ]);
  const val = (r: PromiseSettledResult<Record<string, unknown> | null>) =>
    r.status === 'fulfilled' ? r.value : { error: (r.reason as Error)?.message ?? 'falló' };
  const digest: Record<string, unknown> = {
    sales: val(sales),
    products: val(products),
    customers: val(customers),
    promotions: val(promotions),
  };
  const optional: Array<[string, PromiseSettledResult<Record<string, unknown> | null>]> = [
    ['abandoned_carts', carts],
    ['search_gaps', searchGaps],
    ['loyalty', loyalty],
  ];
  for (const [key, r] of optional) {
    const v = val(r);
    if (v) digest[key] = v;
  }
  return digest;
}

export function buildTriagePrompt(digest: Record<string, unknown>, limit: number): string {
  return [
    `Sos el triage de un motor de propuestas de negocio para un e-commerce. Abajo va un digest de señales (ventas, catálogo, clientes) con cifras reales. Identificá las ${limit} MEJORES oportunidades accionables y devolvé SOLO un array JSON (sin texto extra, sin fences), donde cada item es:`,
    `{"type":"<uno de: ${PROPOSAL_LEAD_TYPES.join(' | ')}>","evidence":"cifras/IDs concretos del digest que lo justifican","focus":"encargo puntual para el especialista"}`,
    'Guía de tipos: promo (2x1/combo/envío gratis/descuento), pricing (price list o ajuste de precio, también hacia arriba), inventory (reposición por quiebre de algo que vende), bundle (colección de productos que van juntos), winback (recuperar clientes en riesgo), ops (pagos sin capturar/demoras), blog (nota que empuje productos), banner (pieza visual para un pico o promo), landing (página para una temporada/categoría), campaign (campaña completa promo+banner+landing+nota para una fecha fuerte), dynamic_group (segmento automático de clientes por comportamiento), promo_lifecycle (pausar promo activa sin uso o extender/replicar la exitosa — mirá promotions.idle_active_promotions), cart_recovery (incentivo para carritos abandonados — mirá abandoned_carts), search_gap (búsquedas sin resultados — mirá search_gaps), loyalty (campaña de puntos o reward — SOLO si loyalty.active_program existe).',
    `Reglas: DIVERSIDAD (máximo UN lead de descuento puro; cubrí tipos distintos), cada lead debe citar cifras REALES del digest en evidence, y si el digest está vacío o sin señal devolvé [].`,
    `DIGEST:\n${JSON.stringify(digest)}`,
  ].join('\n');
}

/** Parseo tolerante del output del triage: encuentra el array JSON y valida los leads. */
export function parseTriageLeads(text: string, max: number): ProposalLead[] {
  if (!text) return [];
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const valid = new Set<string>(PROPOSAL_LEAD_TYPES);
  const out: ProposalLead[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const type = typeof o.type === 'string' ? o.type.trim() : '';
    if (!valid.has(type)) continue;
    out.push({
      type: type as ProposalLeadType,
      evidence: typeof o.evidence === 'string' ? o.evidence.trim() : '',
      focus: typeof o.focus === 'string' ? o.focus.trim() : '',
    });
    if (out.length >= max) break;
  }
  return out;
}

/** Corre `fn` sobre los items con a lo sumo `cap` en vuelo. */
async function runLimited<T, R>(items: T[], cap: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(cap, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Entrada única (job + route)
// ---------------------------------------------------------------------------

export type GenerateProposalsArgs = {
  container: MedusaContainer;
  /** Servicio del módulo ai-assistant (AiStore + listAgents/createProposals). */
  service: any;
  limit: number;
  /** Si viene, corre SOLO ese agente en modo simple (override manual). */
  agentKey?: string;
  createdBy: string;
  model?: string;
  maxTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  memory?: MemoryRuntimeOptions;
  log?: (msg: string) => void;
};

export type GenerateProposalsResult = {
  created: unknown[];
  agentKeys: string[];
  engine: 'specialists' | 'simple';
};

async function persistParsed(
  service: any,
  agentKey: string,
  parsed: ParsedProposal[],
  createdBy: string,
): Promise<unknown[]> {
  const created: unknown[] = [];
  for (const p of parsed) {
    created.push(
      await service.createProposals({
        agent_key: agentKey,
        title: p.title,
        summary: p.summary,
        rationale: p.rationale ?? null,
        proposed_actions: p.proposed_actions,
        expected_impact: p.expected_impact ?? null,
        status: 'pending',
        source: 'proactive',
        created_by: createdBy,
      }),
    );
  }
  return created;
}

const SPECIALIST_CONCURRENCY = 3;

/**
 * Punto de entrada único del cron y del botón "Generar propuestas". Elige el
 * motor (specialists | simple), corre el análisis y persiste las propuestas.
 *
 * Los tres topes del motor —qué motor, cuántos pasos por especialista, cuántos
 * por agente en modo simple— se leen ACÁ ADENTRO y no en `const` de nivel
 * superior. El `MAX_STEPS_SPECIALIST` que había arriba se evaluaba al IMPORTAR el
 * módulo, o sea antes de que el loader de `app-settings` llenara el snapshot: una
 * fila en la base nunca lo habría movido y la card habría mentido. Leerlo por
 * corrida cuesta tres lookups en un Map.
 */
export async function generateProposals(args: GenerateProposalsArgs): Promise<GenerateProposalsResult> {
  const { container, service, limit, createdBy, model, maxTokens, reasoningEffort, memory } = args;
  const log = args.log ?? (() => {});
  const settings = getAiAssistantSettings();
  const useSpecialists = settings.proposalsEngine !== 'simple' && !args.agentKey;
  const nativeCtx = { container, store: service as AiStore };

  if (useSpecialists) {
    try {
      const digest = await collectSignals(container);
      const triage = await chatComplete({
        model,
        messages: [
          { role: 'user', content: buildTriagePrompt(digest, limit) },
        ] as ApiMessage[],
        maxTokens,
        reasoningEffort,
      });
      const leads = parseTriageLeads(triage.content ?? '', limit);
      if (leads.length > 0) {
        log(`[proposals] triage: ${leads.length} lead(s): ${leads.map((l) => l.type).join(', ')}`);
        const created: unknown[] = [];
        const agentKeys = new Set<string>();
        const results = await runLimited(leads, SPECIALIST_CONCURRENCY, async (lead) => {
          const agentKey = LEAD_AGENT_KEYS[lead.type];
          try {
            const text = await runHeadlessAnalysis({
              store: service as AiStore,
              agentKey,
              task: buildSpecialistTask(lead),
              model,
              maxTokens,
              reasoningEffort,
              memory,
              maxSteps: settings.proposalsSpecialistSteps,
              nativeCtx,
              nativeToolsPolicy: 'analysis-only',
            });
            // Un especialista devuelve UNA propuesta; si emitió más, se toma la primera.
            return { agentKey, parsed: parseProposals(text).slice(0, 1) };
          } catch (err) {
            log(`[proposals] especialista "${lead.type}" falló: ${(err as Error).message}`);
            return { agentKey, parsed: [] as ParsedProposal[] };
          }
        });
        for (const r of results) {
          if (!r.parsed.length) continue;
          agentKeys.add(r.agentKey);
          created.push(...(await persistParsed(service, r.agentKey, r.parsed, createdBy)));
        }
        return { created, agentKeys: [...agentKeys], engine: 'specialists' };
      }
      log('[proposals] triage sin leads; se cae al modo simple.');
    } catch (err) {
      log(`[proposals] motor specialists falló (${(err as Error).message}); se cae al modo simple.`);
    }
  }

  // Modo simple: fan-out por agente (comportamiento pre-motor / override manual).
  let agentKeys: string[];
  if (args.agentKey) {
    agentKeys = [args.agentKey];
  } else {
    try {
      const rows = await service.listAgents({}, { take: 200 });
      agentKeys = resolveProposalAgentKeys(rows, 'ventas');
    } catch (err) {
      log(`[proposals] list agents falló: ${(err as Error).message}`);
      agentKeys = ['ventas'];
    }
  }
  const created: unknown[] = [];
  for (const agentKey of agentKeys) {
    let text: string;
    try {
      text = await runHeadlessAnalysis({
        store: service as AiStore,
        agentKey,
        task: buildAnalysisTask({ limit, focus: PROPOSAL_AGENT_FOCUS[agentKey] }),
        model,
        maxTokens,
        reasoningEffort,
        memory,
        maxSteps: settings.proposalsMaxSteps,
        nativeCtx,
        nativeToolsPolicy: 'analysis-only',
      });
    } catch (err) {
      // Un agente que falla no aborta a los demás.
      log(`[proposals] análisis de "${agentKey}" falló: ${(err as Error).message}`);
      continue;
    }
    created.push(...(await persistParsed(service, agentKey, parseProposals(text), createdBy)));
  }
  return { created, agentKeys, engine: 'simple' };
}
