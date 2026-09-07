import type { AiStore } from './types';

/**
 * Lógica compartida de la CAMPAÑA COMERCIAL (estado + checklist + validación).
 * La usan las tools nativas `campaign_get`/`campaign_set` y la ruta de mensajes
 * (que intercepta los bloques `<campaign_step>` enviados desde el chat). Es la
 * fuente de verdad del wizard: el Orquestador nunca tiene que mantener el JSON
 * en su contexto, lo lee/escribe acá.
 */

export type CustomerGroupTarget = 'all' | 'none' | string; // string = customer_group_id

export type CampaignState = {
  campaign: {
    name?: string | null;
    objective?: string[];
    start_date?: string | null;
    end_date?: string | null;
    customer_groups?: CustomerGroupTarget[];
    tone?: string[] | null;
  };
  deliverables: {
    blog_post?: boolean;
    banner?: boolean;
    promotion?: boolean;
    landing?: boolean;
  };
  product_selection: {
    mode?: 'ai_suggested' | 'manual' | 'category' | 'tag' | 'from_promotion' | null;
    category_ids?: string[];
    tag_ids?: string[];
    product_ids?: string[];
    promotion_id?: string | null;
  };
  promotion: {
    type?: 'percentage' | 'fixed' | 'bogo' | 'combo' | 'free_shipping' | 'highlight_only' | null;
    value?: number | null;
    applies_to?: string;
    customer_groups?: string[];
    conditions?: string | null;
  };
  outputs: {
    blog_post?: Record<string, unknown> | null;
    banner?: Record<string, unknown> | null;
    landing?: Record<string, unknown> | null;
    promotion?: Record<string, unknown> | null;
  };
  validation: {
    is_ready?: boolean;
    warnings?: string[];
    missing_fields?: string[];
  };
};

export type ChecklistStatus = 'pending' | 'active' | 'done';
export type CampaignChecklistItem = { key: string; label: string; status: ChecklistStatus };

/** Estado vacío con la forma del PRD. */
export function emptyCampaignState(): CampaignState {
  return {
    campaign: {
      name: null,
      objective: [],
      start_date: null,
      end_date: null,
      customer_groups: [],
      tone: null,
    },
    deliverables: { blog_post: false, banner: false, promotion: false, landing: false },
    product_selection: { mode: null, category_ids: [], tag_ids: [], product_ids: [], promotion_id: null },
    promotion: { type: null, value: null, applies_to: 'selected_products', customer_groups: [], conditions: null },
    outputs: { blog_post: null, banner: null, landing: null, promotion: null },
    validation: { is_ready: false, warnings: [], missing_fields: [] },
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Merge profundo: los objetos se mergean recursivamente; los arrays y escalares
 * del patch REEMPLAZAN (semántica "setear product_ids a [...]"). null borra.
 */
export function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

function nonEmptyStr(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}
function nonEmptyArr(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

/** ¿El brief base está completo? (nombre + fechas + público elegido). */
function briefDone(s: CampaignState): boolean {
  return (
    nonEmptyStr(s.campaign.name) &&
    nonEmptyStr(s.campaign.start_date) &&
    nonEmptyStr(s.campaign.end_date) &&
    nonEmptyArr(s.campaign.customer_groups)
  );
}
function anyDeliverable(s: CampaignState): boolean {
  const d = s.deliverables || {};
  return !!(d.blog_post || d.banner || d.promotion || d.landing);
}
function productsChosen(s: CampaignState): boolean {
  const ps = s.product_selection || {};
  if (!ps.mode) return false;
  if (ps.mode === 'ai_suggested') return true;
  if (ps.mode === 'manual') return nonEmptyArr(ps.product_ids);
  if (ps.mode === 'category') return nonEmptyArr(ps.category_ids);
  if (ps.mode === 'tag') return nonEmptyArr(ps.tag_ids);
  if (ps.mode === 'from_promotion') return nonEmptyStr(ps.promotion_id);
  return false;
}

/**
 * Deriva el checklist visible del PRD a partir del estado. Los items de
 * entregables solo aparecen si el entregable fue elegido. El item "active" (→) es
 * el primer pendiente aplicable; el resto pendientes quedan en 'pending' (○).
 */
export function computeChecklist(s: CampaignState, status?: string): CampaignChecklistItem[] {
  const d = s.deliverables || {};
  const done = {
    brief: briefDone(s),
    deliverables: anyDeliverable(s),
    products: productsChosen(s),
    promotion: nonEmptyStr(s.promotion?.type),
    blog_post: !!s.outputs?.blog_post,
    banner: !!s.outputs?.banner,
    landing: !!s.outputs?.landing,
    validation: !!s.validation?.is_ready,
    confirm: status === 'confirmed',
  };

  const defs: Array<{ key: keyof typeof done; label: string; show: boolean }> = [
    { key: 'brief', label: 'Brief definido', show: true },
    { key: 'deliverables', label: 'Entregables seleccionados', show: true },
    { key: 'products', label: 'Selección de productos', show: true },
    { key: 'promotion', label: 'Configuración de promoción', show: !!d.promotion },
    { key: 'blog_post', label: 'Nota de blog', show: !!d.blog_post },
    { key: 'banner', label: 'Banner', show: !!d.banner },
    { key: 'landing', label: 'Landing', show: !!d.landing },
    { key: 'validation', label: 'Validación final', show: true },
    { key: 'confirm', label: 'Confirmar publicación', show: true },
  ];

  const items = defs.filter((x) => x.show);
  let activeAssigned = false;
  return items.map((x) => {
    let st: ChecklistStatus;
    if (done[x.key]) st = 'done';
    else if (!activeAssigned) {
      st = 'active';
      activeAssigned = true;
    } else st = 'pending';
    return { key: x.key, label: x.label, status: st };
  });
}

/** Valida coherencia del estado y devuelve faltantes/warnings/is_ready. */
export function computeValidation(s: CampaignState): CampaignState['validation'] {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!nonEmptyStr(s.campaign?.name)) missing.push('nombre');
  if (!nonEmptyStr(s.campaign?.start_date)) missing.push('fecha_inicio');
  if (!nonEmptyStr(s.campaign?.end_date)) missing.push('fecha_fin');
  if (!nonEmptyArr(s.campaign?.customer_groups)) missing.push('publico');
  if (!anyDeliverable(s)) missing.push('entregables');
  if (!productsChosen(s)) missing.push('seleccion_productos');

  // Fechas coherentes.
  const start = s.campaign?.start_date ? Date.parse(String(s.campaign.start_date)) : NaN;
  const end = s.campaign?.end_date ? Date.parse(String(s.campaign.end_date)) : NaN;
  if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
    warnings.push('La fecha de finalización es anterior a la de inicio.');
  }

  // Promoción elegida pero sin tipo / sin valor donde aplica.
  if (s.deliverables?.promotion) {
    if (!nonEmptyStr(s.promotion?.type)) missing.push('tipo_promocion');
    const needsValue = s.promotion?.type === 'percentage' || s.promotion?.type === 'fixed';
    if (needsValue && (s.promotion?.value == null || Number(s.promotion?.value) <= 0)) {
      missing.push('valor_promocion');
    }
  }

  // Contenido elegido pero sin tono definido → warning (no bloquea).
  const needsTone = s.deliverables?.blog_post || s.deliverables?.banner || s.deliverables?.landing;
  if (needsTone && !nonEmptyArr(s.campaign?.tone)) {
    warnings.push('Elegiste contenido pero no definiste el tono de la campaña.');
  }

  return { is_ready: missing.length === 0, warnings, missing_fields: missing };
}

/** Normaliza una fila de DB a CampaignState (rellena con la forma vacía). */
export function normalizeState(raw: unknown): CampaignState {
  const base = emptyCampaignState();
  if (!isPlainObject(raw)) return base;
  return deepMerge(base as unknown as Record<string, unknown>, raw) as unknown as CampaignState;
}

/** Sub-objeto de `state` (el <result> de un paso del workflow), o {} si no corrió / no devolvió json. */
export function stepOut(state: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = state[key];
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
/** Filtra un valor a lista de strings (o [] si no es array). */
export function strList(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Mapea los `<result>` de cada paso del workflow `campania_comercial` al patch de
 * estado de la campaña (outputs + product_ids resueltos + warnings). PURO (sin I/O):
 * lo usa el motor al terminar el workflow para dejar la campaña lista para el preview,
 * de forma determinística. Solo incluye un output cuando el paso devolvió su id real,
 * así el preview no ofrece links/botones que apunten a nada (los botones de acción
 * leen justamente promotion_id/post_id/banner_id/landing_id de estos outputs).
 */
export function buildCampaignOutputsPatch(state: Record<string, unknown>): Record<string, unknown> {
  const promo = stepOut(state, 'preparar_promocion');
  const nota = stepOut(state, 'crear_nota');
  const banner = stepOut(state, 'crear_banner');
  const landing = stepOut(state, 'crear_landing');
  const validar = stepOut(state, 'validar');

  const outputs: Record<string, unknown> = {};
  if (typeof promo.promotion_id === 'string') {
    outputs.promotion = { promotion_id: promo.promotion_id, type: promo.type ?? null, status: promo.status ?? 'inactive' };
  }
  if (typeof nota.post_id === 'string') {
    outputs.blog_post = { post_id: nota.post_id, slug: nota.slug ?? null, preview_url: nota.preview_url ?? null };
  }
  if (typeof banner.banner_id === 'string') {
    outputs.banner = { banner_id: banner.banner_id };
  }
  if (typeof landing.landing_id === 'string') {
    outputs.landing = { landing_id: landing.landing_id, slug: landing.slug ?? null };
  }

  const patch: Record<string, unknown> = { outputs };
  const resolvedIds = strList(stepOut(state, 'resolver_productos').product_ids);
  if (resolvedIds.length) patch.product_selection = { product_ids: resolvedIds };
  const warnings = strList(validar.warnings);
  if (warnings.length) patch.validation = { warnings };
  return patch;
}

/**
 * Bloque que la interfaz envía cuando el usuario completa un paso del wizard:
 * `<campaign_step step="brief">{patch en forma de state}</campaign_step>`. La ruta
 * de mensajes lo intercepta, persiste el patch y reemplaza el contenido visible
 * por un resumen legible (así el orquestador NO tiene que parsear el JSON del form).
 */
const CAMPAIGN_STEP_RE = /<campaign_step\s+step="([^"]+)"\s*>([\s\S]*?)<\/campaign_step>/i;

export function parseCampaignStep(content: string): { step: string; patch: Record<string, unknown> } | null {
  const m = content.match(CAMPAIGN_STEP_RE);
  if (!m) return null;
  const step = m[1] ?? '';
  try {
    const patch = JSON.parse((m[2] ?? '').trim());
    return { step, patch: patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {} };
  } catch {
    return { step, patch: {} };
  }
}

/** Resumen legible de un paso enviado, para mostrar como mensaje del usuario en el chat. */
export function summarizeCampaignStep(step: string, s: CampaignState): string {
  switch (step) {
    case 'brief': {
      const c = s.campaign;
      const pub = (c.customer_groups ?? []).join(', ') || '—';
      const obj = (c.objective ?? []).join(', ') || '—';
      return `Brief de campaña: "${c.name ?? 'sin nombre'}" · ${c.start_date ?? '?'} → ${c.end_date ?? '?'} · objetivo: ${obj} · público: ${pub}.`;
    }
    case 'deliverables': {
      const on = Object.entries(s.deliverables ?? {})
        .filter(([, v]) => v)
        .map(([k]) => k);
      return `Entregables elegidos: ${on.join(', ') || '—'}.`;
    }
    case 'products': {
      const ps = s.product_selection ?? {};
      const extra =
        ps.mode === 'manual'
          ? ` (${(ps.product_ids ?? []).length} productos)`
          : ps.mode === 'category'
            ? ` (${(ps.category_ids ?? []).length} categorías)`
            : ps.mode === 'tag'
              ? ` (${(ps.tag_ids ?? []).length} etiquetas)`
              : '';
      return `Selección de productos: modo ${ps.mode ?? '—'}${extra}.`;
    }
    case 'promotion': {
      const p = s.promotion ?? {};
      return `Promoción configurada: ${p.type ?? '—'}${p.value != null ? ` (${p.value})` : ''}.`;
    }
    case 'tone':
      return `Tono elegido: ${(s.campaign?.tone ?? []).join(', ') || '—'}.`;
    default:
      return `Paso "${step}" de la campaña completado.`;
  }
}

export type CampaignRow = {
  id: string;
  thread_id: string | null;
  name: string;
  status: string;
  state: CampaignState;
  checklist: CampaignChecklistItem[];
  workflow_run_id: string | null;
};

/** Busca la campaña activa del hilo (la más reciente no cerrada). */
export async function findActiveCampaign(
  store: AiStore,
  threadId: string | null | undefined,
  campaignId?: string | null,
): Promise<CampaignRow | null> {
  try {
    if (campaignId) {
      const row = await store.retrieveCampaign(campaignId).catch(() => null);
      return row ? toRow(row) : null;
    }
    if (!threadId) return null;
    const rows = await store.listCampaigns(
      { thread_id: threadId },
      { order: { created_at: 'DESC' }, take: 20 },
    );
    const open = (rows ?? []).find((r) => r.status !== 'cancelled' && r.status !== 'confirmed') ?? rows?.[0];
    return open ? toRow(open) : null;
  } catch {
    return null;
  }
}

function toRow(r: any): CampaignRow {
  return {
    id: r.id,
    thread_id: r.thread_id ?? null,
    name: r.name ?? '',
    status: r.status ?? 'intake',
    state: normalizeState(r.state),
    checklist: Array.isArray(r.checklist) ? r.checklist : [],
    workflow_run_id: r.workflow_run_id ?? null,
  };
}

/**
 * Aplica un patch al estado de la campaña (crea la campaña si no existe), recomputa
 * checklist + validación y persiste. Devuelve la fila resultante. Esta es la
 * única vía de escritura del estado (tools nativas y ruta de mensajes la usan).
 */
export async function upsertCampaign(opts: {
  store: AiStore;
  threadId?: string | null;
  createdBy?: string | null;
  campaignId?: string | null;
  patch?: Record<string, unknown>;
  statusOverride?: string;
  workflowRunId?: string | null;
  nameHint?: string;
}): Promise<CampaignRow> {
  const { store, threadId = null, createdBy = null, patch = {}, statusOverride, workflowRunId } = opts;
  const existing = await findActiveCampaign(store, threadId, opts.campaignId);

  const nextState = normalizeState(existing ? deepMerge(existing.state as unknown as Record<string, unknown>, patch) : patch);
  // La validación se recomputa siempre desde el estado; se conserva lo que vino en el patch (warnings de subagentes) sumándolo.
  const computed = computeValidation(nextState);
  const patchWarnings = Array.isArray(nextState.validation?.warnings) ? nextState.validation.warnings : [];
  nextState.validation = {
    is_ready: computed.is_ready,
    missing_fields: computed.missing_fields,
    warnings: Array.from(new Set([...(computed.warnings ?? []), ...patchWarnings])),
  };

  const status = statusOverride ?? existing?.status ?? 'intake';
  const checklist = computeChecklist(nextState, status);
  const name =
    nonEmptyStr(nextState.campaign?.name)
      ? String(nextState.campaign.name)
      : existing?.name || opts.nameHint || 'Campaña sin nombre';

  if (!existing) {
    const created = await store.createCampaigns({
      thread_id: threadId,
      name,
      status,
      state: nextState,
      checklist,
      workflow_run_id: workflowRunId ?? null,
      created_by: createdBy,
    });
    const row = Array.isArray(created) ? created[0] : created;
    return toRow(row);
  }

  await store.updateCampaigns({
    id: existing.id,
    name,
    status,
    state: nextState,
    checklist,
    ...(workflowRunId !== undefined ? { workflow_run_id: workflowRunId } : {}),
  });
  return { ...existing, name, status, state: nextState, checklist, workflow_run_id: workflowRunId ?? existing.workflow_run_id };
}
