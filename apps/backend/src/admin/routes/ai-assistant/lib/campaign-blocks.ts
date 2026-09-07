// Bloques interactivos del wizard de CAMPAÑA COMERCIAL. El Orquestador emite un
// bloque `<campaign_X>{json}</campaign_X>` al final del mensaje; el chat lo parsea
// para renderizar el formulario/selector correspondiente y lo saca del texto
// visible. Al enviarlo, el componente manda un `<campaign_step step="X">{patch}
// </campaign_step>` (lo intercepta la ruta de mensajes y persiste el estado).
// Mismo patrón que `visuals.ts` / `options.ts`.

export type CampaignBlockKind =
  | 'form'
  | 'deliverables'
  | 'products'
  | 'promotion'
  | 'tone'
  | 'checklist'
  | 'preview';

const TAGS: Array<{ kind: CampaignBlockKind; tag: string }> = [
  { kind: 'form', tag: 'campaign_form' },
  { kind: 'deliverables', tag: 'campaign_deliverables' },
  { kind: 'products', tag: 'campaign_products' },
  { kind: 'promotion', tag: 'campaign_promotion' },
  { kind: 'tone', tag: 'campaign_tone' },
  { kind: 'checklist', tag: 'campaign_checklist' },
  { kind: 'preview', tag: 'campaign_preview' },
];

export type CampaignBlock = {
  kind: CampaignBlockKind;
  tag: string;
  data: Record<string, unknown>;
};

function extract(content: string, tag: string): Record<string, unknown> | null {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = content.indexOf(open);
  const end = content.indexOf(close);
  if (start === -1) return null;
  const raw = end > start ? content.slice(start + open.length, end).trim() : '';
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Devuelve el PRIMER bloque de campaña presente en el contenido (o null). */
export function parseCampaignBlock(content: string): CampaignBlock | null {
  for (const { kind, tag } of TAGS) {
    const data = extract(content, tag);
    if (data) return { kind, tag, data };
  }
  return null;
}

/** Saca TODOS los bloques de campaña del texto visible. */
export function stripCampaignBlocks(content: string): string {
  let out = content;
  for (const { tag } of TAGS) {
    const open = `<${tag}>`;
    const close = `</${tag}>`;
    const start = out.indexOf(open);
    if (start === -1) continue;
    const end = out.indexOf(close);
    out = end > start ? `${out.slice(0, start)}${out.slice(end + close.length)}` : out.slice(0, start);
  }
  return out.trim();
}

/** Serializa el paso que el usuario completó, para mandarlo como mensaje. */
export function buildCampaignStep(step: string, patch: Record<string, unknown>): string {
  return `<campaign_step step="${step}">${JSON.stringify(patch)}</campaign_step>`;
}

// ── Catálogos estáticos del PRD (labels en español) ─────────────────────────
export const OBJECTIVE_OPTIONS = [
  { value: 'vender_mas', label: 'Vender más' },
  { value: 'destacar_productos', label: 'Destacar productos' },
  { value: 'armar_contenido', label: 'Armar contenido' },
  { value: 'generar_trafico', label: 'Generar tráfico' },
  { value: 'promocionar_categoria', label: 'Promocionar una categoría' },
  { value: 'promocionar_productos', label: 'Promocionar productos específicos' },
];

export const DELIVERABLE_OPTIONS = [
  { value: 'blog_post', label: 'Nota en blog' },
  { value: 'banner', label: 'Banner' },
  { value: 'promotion', label: 'Productos en promoción' },
  { value: 'landing', label: 'Landing' },
];

export const PRODUCT_MODE_OPTIONS = [
  { value: 'ai_suggested', label: 'Que la IA sugiera productos' },
  { value: 'manual', label: 'Elegir productos manualmente' },
  { value: 'category', label: 'Usar una categoría' },
  { value: 'tag', label: 'Usar una etiqueta' },
  { value: 'from_promotion', label: 'Usar productos de una promoción existente' },
];

export const PROMO_TYPE_OPTIONS = [
  { value: 'percentage', label: 'Descuento porcentual' },
  { value: 'fixed', label: 'Precio fijo' },
  { value: 'bogo', label: '2x1' },
  { value: 'combo', label: 'Combo' },
  { value: 'free_shipping', label: 'Envío gratis' },
  { value: 'highlight_only', label: 'Solo destacar productos, sin descuento' },
];

export const TONE_OPTIONS = [
  { value: 'comercial_directo', label: 'Comercial directo' },
  { value: 'cercano_emocional', label: 'Cercano / emocional' },
  { value: 'premium', label: 'Premium' },
  { value: 'divertido', label: 'Divertido' },
  { value: 'familiar', label: 'Familiar' },
];
