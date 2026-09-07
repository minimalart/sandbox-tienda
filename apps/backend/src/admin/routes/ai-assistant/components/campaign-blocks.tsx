import { Button, Input, Select, DatePicker, Textarea, Badge, toast } from '@medusajs/ui';
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sdk } from '../../../lib/client';
import {
  type CampaignBlock,
  buildCampaignStep,
  OBJECTIVE_OPTIONS,
  DELIVERABLE_OPTIONS,
  PRODUCT_MODE_OPTIONS,
  PROMO_TYPE_OPTIONS,
  TONE_OPTIONS,
} from '../lib/campaign-blocks';

type SubmitFn = (raw: string, display: string) => void;

/** yyyy-mm-dd a partir de un Date (lo que persistimos en el estado). */
function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Chips multiselección (toggle). */
function Chips({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={`rounded-xl border px-3 py-1.5 txt-small transition-colors ${
              on
                ? 'border-ui-fg-base bg-ui-bg-base-pressed text-ui-fg-base'
                : 'border-ui-border-base bg-ui-bg-base text-ui-fg-subtle hover:bg-ui-bg-base-hover'
            }`}
          >
            {on ? '✓ ' : ''}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ml-10 flex flex-col gap-3 rounded-xl border border-ui-border-base bg-ui-bg-base p-4 shadow-elevation-card-rest">
      <p className="txt-compact-small-plus text-ui-fg-base">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="txt-small text-ui-fg-subtle">{label}</span>
      {children}
    </label>
  );
}

// ── Datos vivos de Medusa (admin API) ───────────────────────────────────────
function useAdminList<T = Record<string, unknown>>(path: string, key: string, query?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['campaign-admin', path, query],
    queryFn: async () => {
      const r = (await sdk.client.fetch(path, { query })) as Record<string, unknown>;
      return (r[key] as T[]) ?? [];
    },
    staleTime: 60_000,
  });
}

// ── Paso 1: Brief ───────────────────────────────────────────────────────────
function FormBlock({ data, onSubmit, busy }: { data: Record<string, unknown>; onSubmit: SubmitFn; busy: boolean }) {
  const [name, setName] = useState(String(data.suggested_name ?? ''));
  const [objective, setObjective] = useState<string[]>(
    Array.isArray(data.suggested_objective)
      ? (data.suggested_objective as unknown[]).filter((v): v is string => typeof v === 'string')
      : [],
  );
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [audience, setAudience] = useState<'all' | 'none' | 'groups'>('all');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const { data: groups = [] } = useAdminList<{ id: string; name: string }>(
    '/admin/customer-groups',
    'customer_groups',
    { limit: 100 },
  );

  const submit = () => {
    if (!name.trim() || !start || !end) {
      toast.error('Completá nombre y fechas.');
      return;
    }
    const customer_groups = audience === 'all' ? ['all'] : audience === 'none' ? ['none'] : groupIds;
    const patch = {
      campaign: { name: name.trim(), objective, start_date: iso(start), end_date: iso(end), customer_groups },
    };
    onSubmit(buildCampaignStep('brief', patch), `Brief: ${name.trim()}`);
  };

  return (
    <Card title="Brief de la campaña">
      <Field label="Nombre de campaña">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Semana de la Dulzura" />
      </Field>
      <Field label="Objetivo de campaña">
        <Chips options={OBJECTIVE_OPTIONS} value={objective} onChange={setObjective} />
      </Field>
      <div className="flex gap-3">
        <Field label="Fecha de inicio">
          <DatePicker value={start ?? undefined} onChange={(d) => setStart(d ?? null)} />
        </Field>
        <Field label="Fecha de finalización">
          <DatePicker value={end ?? undefined} onChange={(d) => setEnd(d ?? null)} />
        </Field>
      </div>
      <Field label="Público">
        <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
          <Select.Trigger>
            <Select.Value placeholder="Elegí el público" />
          </Select.Trigger>
          <Select.Content className="z-[60]">
            <Select.Item value="all">Todos los clientes</Select.Item>
            <Select.Item value="groups">Uno o varios customer groups</Select.Item>
            <Select.Item value="none">Sin segmentación específica</Select.Item>
          </Select.Content>
        </Select>
      </Field>
      {audience === 'groups' ? (
        <Chips
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
          value={groupIds}
          onChange={setGroupIds}
        />
      ) : null}
      <div>
        <Button size="small" onClick={submit} disabled={busy}>
          Continuar
        </Button>
      </div>
    </Card>
  );
}

// ── Paso 2: Entregables ───────────────────────────────────────────────────────
function DeliverablesBlock({ onSubmit, busy }: { onSubmit: SubmitFn; busy: boolean }) {
  const [sel, setSel] = useState<string[]>([]);
  const submit = () => {
    if (sel.length === 0) {
      toast.error('Elegí al menos un entregable.');
      return;
    }
    const deliverables = {
      blog_post: sel.includes('blog_post'),
      banner: sel.includes('banner'),
      promotion: sel.includes('promotion'),
      landing: sel.includes('landing'),
    };
    const labels = DELIVERABLE_OPTIONS.filter((o) => sel.includes(o.value)).map((o) => o.label);
    onSubmit(buildCampaignStep('deliverables', { deliverables }), `Entregables: ${labels.join(', ')}`);
  };
  return (
    <Card title="¿Qué querés generar?">
      <Chips options={DELIVERABLE_OPTIONS} value={sel} onChange={setSel} />
      <div>
        <Button size="small" onClick={submit} disabled={busy}>
          Continuar
        </Button>
      </div>
    </Card>
  );
}

// ── Paso 3: Selección de productos ────────────────────────────────────────────
function ProductsBlock({ onSubmit, busy }: { onSubmit: SubmitFn; busy: boolean }) {
  const [mode, setMode] = useState<string>('ai_suggested');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [promotionId, setPromotionId] = useState<string>('');
  const [q, setQ] = useState('');

  const { data: products = [] } = useAdminList<{ id: string; title: string }>(
    '/admin/products',
    'products',
    { limit: 20, q: q || undefined },
  );
  const { data: categories = [] } = useAdminList<{ id: string; name: string }>(
    '/admin/product-categories',
    'product_categories',
    { limit: 100 },
  );
  const { data: tags = [] } = useAdminList<{ id: string; value: string }>(
    '/admin/product-tags',
    'product_tags',
    { limit: 100 },
  );
  const { data: promotions = [] } = useAdminList<{ id: string; code: string }>(
    '/admin/promotions',
    'promotions',
    { limit: 100 },
  );

  const submit = () => {
    const patch: Record<string, unknown> = {
      product_selection: {
        mode,
        product_ids: mode === 'manual' ? productIds : [],
        category_ids: mode === 'category' ? categoryIds : [],
        tag_ids: mode === 'tag' ? tagIds : [],
        promotion_id: mode === 'from_promotion' ? promotionId || null : null,
      },
    };
    const label = PRODUCT_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? mode;
    onSubmit(buildCampaignStep('products', patch), `Productos: ${label}`);
  };

  return (
    <Card title="¿Cómo elegimos los productos?">
      <Select value={mode} onValueChange={setMode}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content className="z-[60]">
          {PRODUCT_MODE_OPTIONS.map((o) => (
            <Select.Item key={o.value} value={o.value}>
              {o.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>

      {mode === 'manual' ? (
        <div className="flex flex-col gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productos…" />
          <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
            <Chips
              options={products.map((p) => ({ value: p.id, label: p.title }))}
              value={productIds}
              onChange={setProductIds}
            />
          </div>
        </div>
      ) : null}
      {mode === 'category' ? (
        <Chips options={categories.map((c) => ({ value: c.id, label: c.name }))} value={categoryIds} onChange={setCategoryIds} />
      ) : null}
      {mode === 'tag' ? (
        <Chips options={tags.map((t) => ({ value: t.id, label: t.value }))} value={tagIds} onChange={setTagIds} />
      ) : null}
      {mode === 'from_promotion' ? (
        <Select value={promotionId} onValueChange={setPromotionId}>
          <Select.Trigger>
            <Select.Value placeholder="Elegí una promoción" />
          </Select.Trigger>
          <Select.Content className="z-[60]">
            {promotions.map((p) => (
              <Select.Item key={p.id} value={p.id}>
                {p.code}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      ) : null}
      {mode === 'ai_suggested' ? (
        <p className="txt-small text-ui-fg-subtle">La IA va a sugerir productos relevantes según el brief.</p>
      ) : null}

      <div>
        <Button size="small" onClick={submit} disabled={busy}>
          Continuar
        </Button>
      </div>
    </Card>
  );
}

// ── Paso 4: Promoción ─────────────────────────────────────────────────────────
function PromotionBlock({ onSubmit, busy }: { onSubmit: SubmitFn; busy: boolean }) {
  const [type, setType] = useState<string>('percentage');
  const [value, setValue] = useState<string>('');
  const [conditions, setConditions] = useState('');
  const needsValue = type === 'percentage' || type === 'fixed';
  const submit = () => {
    if (needsValue && !value.trim()) {
      toast.error('Ingresá el valor del descuento.');
      return;
    }
    const patch = {
      deliverables: { promotion: true },
      promotion: {
        type,
        value: needsValue ? Number(value) : null,
        applies_to: 'selected_products',
        conditions: conditions.trim() || null,
      },
    };
    const label = PROMO_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
    onSubmit(buildCampaignStep('promotion', patch), `Promoción: ${label}`);
  };
  return (
    <Card title="Configuración de la promoción">
      <Field label="Tipo de promoción">
        <Select value={type} onValueChange={setType}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content className="z-[60]">
            {PROMO_TYPE_OPTIONS.map((o) => (
              <Select.Item key={o.value} value={o.value}>
                {o.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </Field>
      {needsValue ? (
        <Field label={type === 'percentage' ? 'Porcentaje (%)' : 'Monto'}>
          <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
      ) : null}
      <Field label="Condiciones o límites (opcional)">
        <Textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} />
      </Field>
      <div>
        <Button size="small" onClick={submit} disabled={busy}>
          Continuar
        </Button>
      </div>
    </Card>
  );
}

// ── Paso 5: Tono ──────────────────────────────────────────────────────────────
function ToneBlock({ data, onSubmit, busy }: { data: Record<string, unknown>; onSubmit: SubmitFn; busy: boolean }) {
  const suggested = Array.isArray(data.suggested) ? (data.suggested as string[]) : [];
  const [tone, setTone] = useState<string[]>(suggested);
  const submit = () => {
    const labels = TONE_OPTIONS.filter((o) => tone.includes(o.value)).map((o) => o.label);
    onSubmit(buildCampaignStep('tone', { campaign: { tone } }), `Tono: ${labels.join(', ') || '—'}`);
  };
  return (
    <Card title="Tono y enfoque de la campaña">
      <Chips options={TONE_OPTIONS} value={tone} onChange={setTone} />
      <div>
        <Button size="small" onClick={submit} disabled={busy}>
          Continuar
        </Button>
      </div>
    </Card>
  );
}

// ── Checklist (derivado del estado de la campaña) ────────────────────────────
const MARK: Record<string, string> = { done: '✓', active: '→', pending: '○' };
function ChecklistBlock({ data, threadId }: { data: Record<string, unknown>; threadId: string | null }) {
  const inline = Array.isArray(data.items) ? (data.items as Array<{ label: string; status: string }>) : null;
  const { data: fetched } = useQuery({
    queryKey: ['campaign-state', threadId],
    queryFn: async () => {
      const r = (await sdk.client.fetch(`/admin/ai-assistant/threads/${threadId}/campaign`)) as {
        campaign?: { name?: string; checklist?: Array<{ label: string; status: string }> };
      };
      return r.campaign ?? null;
    },
    enabled: !inline && !!threadId,
  });
  const items = inline ?? fetched?.checklist ?? [];
  if (items.length === 0) return null;
  return (
    <Card title={`Campaña${fetched?.name ? `: ${fetched.name}` : ''}`}>
      <ul className="flex flex-col gap-1">
        {items.map((it, idx) => (
          <li
            key={idx}
            className={`txt-small ${it.status === 'active' ? 'text-ui-fg-base font-medium' : it.status === 'done' ? 'text-ui-fg-subtle' : 'text-ui-fg-muted'}`}
          >
            {MARK[it.status] ?? '○'} {it.label}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Paso 7: Preview + acciones reales (gateadas por el click) ────────────────
type CampaignState = {
  campaign?: { name?: string; start_date?: string; end_date?: string; customer_groups?: string[]; tone?: string[] };
  deliverables?: Record<string, boolean>;
  product_selection?: { mode?: string; product_ids?: string[] };
  promotion?: { type?: string; value?: number | null };
  outputs?: Record<string, { preview_url?: string; slug?: string } | null>;
  validation?: { is_ready?: boolean; warnings?: string[]; missing_fields?: string[] };
};

function PreviewBlock({ threadId, busy }: { threadId: string | null; busy: boolean }) {
  const [running, setRunning] = useState<string | null>(null);
  const { data: campaign, refetch } = useQuery({
    queryKey: ['campaign-state-preview', threadId],
    queryFn: async () => {
      const r = (await sdk.client.fetch(`/admin/ai-assistant/threads/${threadId}/campaign`)) as {
        campaign?: { state?: CampaignState };
      };
      return r.campaign?.state ?? null;
    },
    enabled: !!threadId,
  });

  const action = async (act: string) => {
    setRunning(act);
    try {
      const r = (await sdk.client.fetch(`/admin/ai-assistant/threads/${threadId}/campaign`, {
        method: 'POST',
        body: { action: act },
      })) as { message?: string };
      toast.success(r.message ?? 'Listo.');
      await refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(null);
    }
  };

  const d = campaign?.deliverables ?? {};
  const out = campaign?.outputs ?? {};
  const warnings = campaign?.validation?.warnings ?? [];
  const missing = campaign?.validation?.missing_fields ?? [];

  return (
    <Card title={`Resumen — ${campaign?.campaign?.name ?? 'Campaña'}`}>
      <div className="flex flex-col gap-1 txt-small text-ui-fg-subtle">
        <span>
          Fechas: {campaign?.campaign?.start_date ?? '?'} → {campaign?.campaign?.end_date ?? '?'}
        </span>
        <span>Público: {(campaign?.campaign?.customer_groups ?? []).join(', ') || '—'}</span>
        <span>Productos: {(campaign?.product_selection?.product_ids ?? []).length || campaign?.product_selection?.mode}</span>
        {campaign?.promotion?.type ? (
          <span>
            Promoción: {campaign.promotion.type}
            {campaign.promotion.value != null ? ` (${campaign.promotion.value})` : ''}
          </span>
        ) : null}
      </div>

      {(out.blog_post?.preview_url || out.landing?.slug) && (
        <div className="flex flex-wrap gap-2">
          {out.blog_post?.preview_url ? (
            <a className="txt-small text-ui-fg-interactive underline" href={out.blog_post.preview_url} target="_blank" rel="noreferrer">
              Preview de la nota
            </a>
          ) : null}
        </div>
      )}

      {warnings.length > 0 ? (
        <div className="flex flex-col gap-1">
          {warnings.map((w, i) => (
            <p key={i} className="txt-small text-amber-700">⚠ {w}</p>
          ))}
        </div>
      ) : null}
      {missing.length > 0 ? (
        <p className="txt-small text-amber-700">Faltan: {missing.join(', ')}.</p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {d.promotion ? (
          <Button size="small" variant="secondary" disabled={busy || !!running} onClick={() => action('apply_promotion')}>
            {running === 'apply_promotion' ? 'Aplicando…' : 'Aplicar promoción'}
          </Button>
        ) : null}
        {d.blog_post ? (
          <Button size="small" variant="secondary" disabled={busy || !!running} onClick={() => action('publish_blog')}>
            Publicar nota
          </Button>
        ) : null}
        {d.banner ? (
          <Button size="small" variant="secondary" disabled={busy || !!running} onClick={() => action('publish_banner')}>
            Publicar banner
          </Button>
        ) : null}
        {d.landing ? (
          <Button size="small" variant="secondary" disabled={busy || !!running} onClick={() => action('publish_landing')}>
            Publicar landing
          </Button>
        ) : null}
        <Button size="small" variant="transparent" disabled={busy || !!running} onClick={() => action('save_draft')}>
          Guardar como borrador
        </Button>
        <Button size="small" variant="transparent" disabled={busy || !!running} onClick={() => action('cancel')}>
          Cancelar
        </Button>
      </div>
      {campaign?.validation?.is_ready === false ? (
        <Badge size="2xsmall" color="orange">Revisá los faltantes antes de publicar</Badge>
      ) : null}
    </Card>
  );
}

/** Router de bloques de campaña: renderiza el interactivo según el tag emitido. */
export function CampaignBlockView({
  block,
  threadId,
  onSubmit,
  busy,
}: {
  block: CampaignBlock;
  threadId: string | null;
  onSubmit: SubmitFn;
  busy: boolean;
}) {
  switch (block.kind) {
    case 'form':
      return <FormBlock data={block.data} onSubmit={onSubmit} busy={busy} />;
    case 'deliverables':
      return <DeliverablesBlock onSubmit={onSubmit} busy={busy} />;
    case 'products':
      return <ProductsBlock onSubmit={onSubmit} busy={busy} />;
    case 'promotion':
      return <PromotionBlock onSubmit={onSubmit} busy={busy} />;
    case 'tone':
      return <ToneBlock data={block.data} onSubmit={onSubmit} busy={busy} />;
    case 'checklist':
      return <ChecklistBlock data={block.data} threadId={threadId} />;
    case 'preview':
      return <PreviewBlock threadId={threadId} busy={busy} />;
    default:
      return null;
  }
}
