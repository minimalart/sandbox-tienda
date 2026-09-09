import { Badge, Button, Container, Drawer, Heading, StatusBadge, Table, Text, Textarea, toast, usePrompt } from '@medusajs/ui';
import { ChevronLeftMini, ChevronRightMini } from '@medusajs/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useAdminCategories,
  useApplyExecution,
  useCancelExecution,
  useCatalogadorConfig,
  useDeleteExecution,
  useDuplicateExecution,
  useExecution,
  useGenerateExecution,
  useRefloatExecution,
  useRestoreExecution,
  useReviewAsset,
  useReviewProduct,
  useUpdateComposition,
  type AiUsageBreakdown,
  type CatalogingAssetProposal,
  type CatalogingExecutionProduct,
  type CatalogingOperation,
} from '../../../hooks/api';
import {
  CompositionPreview,
  EditableLifestyleEditor,
  readEditableMeta,
} from '../../../components/catalogador/editable-lifestyle-editor';
import { resolveProposalView, type Proposal } from './lib';

export const handle = { breadcrumb: () => 'Ejecución' };

const ACTIVE_STATUSES = ['generating', 'applying'];
/** Espejo del default del backend (`config.ts` → rules.low_confidence_threshold). */
const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.5;
const FREETEXT_FIELDS = ['subtitle', 'description', 'meta_title', 'meta_description', 'alt_text'];
const FIELD_LABELS: Record<string, string> = {
  subtitle: 'Subtítulo',
  description: 'Descripción',
  meta_title: 'Meta title',
  meta_description: 'Meta description',
  keywords: 'Keywords',
  categories: 'Categorías',
  tags: 'Tags',
  alt_text: 'Alt text',
};

/** Traducciones de los estados/eventos (los valores crudos vienen en inglés del backend). */
const EXECUTION_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  generating: 'Generando',
  pending_review: 'Pendiente de revisión',
  partially_reviewed: 'Parcialmente revisada',
  ready_to_apply: 'Lista para aplicar',
  applying: 'Aplicando',
  applied: 'Aplicada',
  partially_applied: 'Parcialmente aplicada',
  error: 'Error',
  cancelled: 'Cancelada',
  restored: 'Restaurada',
};
const PRODUCT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  generating: 'Generando',
  proposed: 'Con propuesta',
  no_changes: 'Sin cambios',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  excluded: 'Excluida',
  applied: 'Aplicada',
  apply_failed: 'Falló al aplicar',
  error: 'Error',
};
const ASSET_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  proposed: 'Propuesta',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  applied: 'Aplicada',
  error: 'Error',
};
const ACTIVITY_LABELS: Record<string, string> = {
  created: 'Creada',
  generation_started: 'Generación iniciada',
  generation_completed: 'Generación completada',
  apply_started: 'Aplicación iniciada',
  applied: 'Aplicada',
  apply_failed: 'Falló al aplicar',
  reviewed: 'Revisada',
  edited: 'Editada',
  cancelled: 'Cancelada',
  duplicated: 'Duplicada',
  refloated: 'Reflotada',
  restored: 'Restaurada',
  error: 'Error',
  'catalogador.lifestyle_editable.generated': 'Lifestyle editable generado',
  'catalogador.lifestyle_editable.edited': 'Lifestyle editable ajustado',
  'catalogador.lifestyle_editable.applied': 'Lifestyle editable aplicado',
  'catalogador.lifestyle_editable.failed': 'Lifestyle editable falló',
  'catalogador.image.skipped': 'Imagen salteada',
};
const IMAGE_SKIP_REASONS: Record<string, string> = {
  scraping_disabled: 'búsqueda web deshabilitada en la configuración',
  no_candidates: 'la búsqueda web no encontró imágenes del producto',
  candidates_unusable: 'ninguna imagen encontrada es utilizable (muy chicas o no descargan)',
  no_reference_image: 'sin imagen propia ni imagen real en la web',
};
const OPERATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  running: 'Corriendo',
  done: 'Hecha',
  error: 'Error',
};
const OPERATION_TYPE_LABELS: Record<string, string> = {
  text_field: 'Texto',
  image_technical: 'Imagen (técnica)',
  image_ai: 'Imagen (IA)',
};
const labelFor = (map: Record<string, string>, value: string) => map[value] ?? value;

/**
 * `warnings` y `errors` del producto vienen como `unknown` (columnas jsonb) y la
 * UI no los mostraba en ningún lado. Son la única explicación de por qué un
 * campo aceptado no terminó en el producto: el apply escribe ahí
 * `Conflicto no aplicado en "X"` y el mensaje del `apply_failed`.
 */
const messagesOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
/** Confianza 0-1 → porcentaje legible (la config y la IA la manejan como fracción). */
const pct = (value: number) => `${Math.round(value * 100)}%`;

/**
 * Costo IA en USD. Los costos por llamada son del orden de 1e-4, así que se
 * muestran 4 decimales (y 6 para importes muy chicos, para no mostrar "US$ 0").
 */
const formatUsd = (usd: number): string => {
  const decimals = usd > 0 && usd < 0.0001 ? 6 : 4;
  return `US$ ${usd.toFixed(decimals)}`;
};

/** Línea de costo IA: total + desglose texto/imágenes y cantidad de llamadas. */
/** Etiqueta corta de cada etapa técnica, para que se vea QUÉ corrió. */
const TECH_OP_LABELS: Record<string, string> = {
  to_webp: 'WebP',
  compress: 'Comprimir',
  resize: 'Redimensionar',
  normalize: 'Normalizar',
};

type SizeInfo = { bytes?: unknown; width?: unknown; height?: unknown };

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const formatDims = (info: SizeInfo): string | null => {
  const width = asNumber(info.width);
  const height = asNumber(info.height);
  return width && height ? `${width}×${height}` : null;
};

/**
 * Antes → después de una optimización técnica.
 *
 * El pipeline venía guardando `metadata.before`/`after` desde el principio y la UI
 * NUNCA los leía: la única forma de saber si "Comprimir" había hecho algo era mirar
 * la base. Sin esto, una optimización que deja la imagen MÁS PESADA se ve
 * exactamente igual que una que la bajó al objetivo.
 */
const TechnicalDelta = ({ metadata }: { metadata: Record<string, unknown> | null }) => {
  const meta = metadata ?? {};
  const before = (meta.before ?? null) as SizeInfo | null;
  const after = (meta.after ?? null) as SizeInfo | null;
  if (!before || !after) return null;

  const beforeBytes = asNumber(before.bytes);
  const afterBytes = asNumber(after.bytes);
  const ops = Array.isArray(meta.ops) ? (meta.ops as unknown[]).filter((o): o is string => typeof o === 'string') : [];
  const grew = beforeBytes !== null && afterBytes !== null && afterBytes > beforeBytes;
  const delta =
    beforeBytes && afterBytes ? Math.round(((afterBytes - beforeBytes) / beforeBytes) * 100) : null;

  const side = (info: SizeInfo, bytes: number | null) =>
    [formatDims(info), bytes !== null ? formatBytes(bytes) : null].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-1">
      <Text size="xsmall" className="text-ui-fg-subtle">
        {side(before, beforeBytes)} → <span className="font-medium text-ui-fg-base">{side(after, afterBytes)}</span>
        {delta !== null && (
          <span className={grew ? ' text-ui-fg-error' : ' text-ui-fg-interactive'}>
            {` (${delta > 0 ? '+' : ''}${delta}%)`}
          </span>
        )}
      </Text>
      {ops.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {ops.map((op) => (
            <Badge key={op} size="2xsmall">
              {TECH_OP_LABELS[op] ?? op}
            </Badge>
          ))}
        </div>
      )}
      {grew && (
        <Text size="xsmall" className="text-ui-fg-error">
          El resultado quedó más pesado que el original.
        </Text>
      )}
      {meta.target_kb_missed === true && (
        <Text size="xsmall" className="text-ui-fg-error">
          No se alcanzó el peso objetivo, ya en la calidad mínima.
        </Text>
      )}
    </div>
  );
};

const AiCostLine = ({ usage, cost }: { usage: AiUsageBreakdown | null; cost: number }) => {
  if (!usage || usage.calls === 0) return null;
  const parts = [
    usage.text_usd > 0 ? `texto ${formatUsd(usage.text_usd)}` : null,
    usage.image_usd > 0 ? `imágenes ${formatUsd(usage.image_usd)}` : null,
    `${usage.calls} ${usage.calls === 1 ? 'llamada' : 'llamadas'} a OpenRouter`,
  ].filter(Boolean);
  return (
    <Text size="xsmall" className="text-ui-fg-muted">
      Costo IA: {formatUsd(cost)}
      {usage.missing_cost ? ' (mínimo: alguna llamada no informó costo)' : ''} · {parts.join(' · ')}
    </Text>
  );
};

/** Detalle legible del evento (razón del skip de imagen y campos diferidos). */
const activityDetail = (a: { type: string; metadata: Record<string, unknown> | null }): string | null => {
  if (a.type === 'catalogador.image.skipped') {
    const reason = typeof a.metadata?.reason === 'string' ? a.metadata.reason : null;
    return reason ? (IMAGE_SKIP_REASONS[reason] ?? reason) : null;
  }
  // Conflictos del apply: `logActivity` los venía guardando en la metadata del
  // evento `applied` desde el principio y la UI NUNCA los leía. Un campo que el
  // apply saltea porque el producto cambió después de generar era invisible: el
  // operador veía "aplicada" y el campo en null, sin ninguna explicación.
  const conflicts = a.metadata?.conflicts;
  if (Array.isArray(conflicts) && conflicts.length) {
    const names = conflicts.map((f) => labelFor(FIELD_LABELS, String(f))).join(', ');
    return `no se aplicó por conflicto (el producto cambió después de generar): ${names}`;
  }

  // Un "aceptar todo" que no aceptó nada por baja confianza tiene que quedar
  // explicado acá: es la única traza que sobrevive al toast.
  const deferred = a.metadata?.deferred_low_confidence_fields;
  if (Array.isArray(deferred) && deferred.length) {
    const names = deferred
      .map((f) => labelFor(FIELD_LABELS, String((f as { field?: unknown }).field ?? '')))
      .join(', ');
    return deferred.length === 1
      ? `1 campo diferido por baja confianza: ${names}`
      : `${deferred.length} campos diferidos por baja confianza: ${names}`;
  }
  return null;
};

const ExecutionDetail = () => {
  const { id = '' } = useParams();
  const { data, isPending } = useExecution(id);
  const { data: cfgData } = useCatalogadorConfig();
  const { data: catData } = useAdminCategories();
  const categoryNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of catData?.product_categories ?? []) map[c.id] = c.name;
    return map;
  }, [catData]);
  const generate = useGenerateExecution();
  const apply = useApplyExecution();
  const cancel = useCancelExecution();
  const duplicate = useDuplicateExecution();
  const refloat = useRefloatExecution();
  const restore = useRestoreExecution();
  const remove = useDeleteExecution();
  const prompt = usePrompt();
  const navigate = useNavigate();
  const reviewProduct = useReviewProduct(id);
  const reviewAsset = useReviewAsset(id);
  const updateComposition = useUpdateComposition(id);

  // El umbral es configurable (pantalla de config del catalogador): tenerlo
  // hardcodeado hacía que la UI pintara "requiere revisión" con un número que
  // el backend ya no usaba. Hasta que cargue la config se usa el default real.
  const rules = (cfgData?.config?.rules as Record<string, unknown> | undefined) ?? {};
  const lowConfidenceThreshold =
    typeof rules.low_confidence_threshold === 'number'
      ? rules.low_confidence_threshold
      : DEFAULT_LOW_CONFIDENCE_THRESHOLD;
  const requireReviewLowConfidence = rules.require_review_low_confidence !== false;

  const [drawerPid, setDrawerPid] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<CatalogingAssetProposal | null>(null);

  const execution = data?.execution;
  const products = data?.products ?? [];
  const assets = data?.asset_proposals ?? [];
  const activity = data?.activity ?? [];
  const operations = data?.operations ?? [];

  if (isPending || !execution) {
    return (
      <Container>
        <Text>Cargando…</Text>
      </Container>
    );
  }

  const isActive = ACTIVE_STATUSES.includes(execution.status);
  const p = execution.progress;

  const assetsByProduct = new Map<string, CatalogingAssetProposal[]>();
  for (const a of assets) {
    const arr = assetsByProduct.get(a.execution_product_id) ?? [];
    arr.push(a);
    assetsByProduct.set(a.execution_product_id, arr);
  }

  const act = (fn: () => Promise<unknown>, ok: string) =>
    fn()
      .then(() => toast.success(ok))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Error'));

  /**
   * Borrado lógico desde el detalle. Navega al listado al terminar: quedarse acá
   * mostraría el detalle de una corrida que el listado ya no tiene, y refrescar
   * daría 404.
   */
  const handleDelete = async () => {
    const confirmed = await prompt({
      title: 'Eliminar corrida',
      description:
        `¿Eliminar "${execution.name}"? Sale del listado y queda en la papelera, ` +
        'desde donde la podés recuperar. No se toca ningún producto del catálogo.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    remove.mutate(id, {
      onSuccess: () => {
        toast.success('Corrida enviada a la papelera');
        navigate('/catalogador');
      },
      onError: (e: unknown) =>
        toast.error((e as { message?: string })?.message ?? 'No se pudo eliminar'),
    });
  };

  /** Texto de éxito según la decisión: el toast tiene que decir QUÉ se guardó. */
  const reviewSuccessMessage = (body: Record<string, unknown>): string => {
    if (body.action === 'accept_all') return 'Se aceptaron todos los cambios propuestos';
    if (body.action === 'reject_all') return 'Se rechazaron todos los cambios propuestos';
    if (body.action === 'exclude') return 'Producto excluido de la ejecución';
    if (body.action === 'include') return 'Producto incluido en la ejecución';
    const label = labelFor(FIELD_LABELS, String(body.field ?? ''));
    if (body.decision === 'edit') return `${label}: se guardó tu edición`;
    if (body.decision === 'accept') return `${label}: propuesta aceptada`;
    return `${label}: propuesta rechazada`;
  };

  // El gate de baja confianza difiere campos sin aplicar nada y el endpoint
  // respondía 200 igual: el usuario clickeaba "Aceptar todo", no veía NADA y
  // parecía un botón roto. Ahora la respuesta trae los diferidos y se avisan.
  const onFieldDecision = (pid: string, body: Record<string, unknown>) =>
    reviewProduct
      .mutateAsync({ pid, body })
      .then((res) => {
        const deferred = res?.deferred_low_confidence;
        if (!deferred?.count) {
          toast.success(reviewSuccessMessage(body));
          return;
        }
        const detail = deferred.fields
          .map((f) => `${labelFor(FIELD_LABELS, f.field)} (${pct(f.confidence)})`)
          .join(', ');
        const n = deferred.count;
        toast.warning(
          n === 1 ? '1 campo quedó pendiente por baja confianza' : `${n} campos quedaron pendientes por baja confianza`,
          {
            description:
              `${detail}: ${n === 1 ? 'está' : 'están'} por debajo del umbral configurado ` +
              `(${pct(deferred.threshold)}), así que no se auto-${n === 1 ? 'aceptó' : 'aceptaron'}. ` +
              `${n === 1 ? 'Falta decidirlo' : 'Faltan decidirlos'} campo por campo.`,
          }
        );
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'No se pudo guardar la decisión'));

  const canGenerate = ['draft', 'pending_review', 'partially_reviewed', 'error'].includes(execution.status);
  // Incluye `applied`: la misma lista que `apply/route.ts`. Una corrida aplicada
  // con productos aprobados DESPUÉS necesita el botón, o esas aprobaciones no
  // tienen ninguna forma de llegar al catálogo. La ruta corta con 409 si no hay
  // nada aceptado, así que un click de más no hace daño.
  const canApply = ['pending_review', 'partially_reviewed', 'ready_to_apply', 'partially_applied', 'applied'].includes(execution.status);
  const canCancel = !['applied', 'partially_applied', 'applying', 'restored', 'cancelled'].includes(execution.status);
  const canRestore = ['applied', 'partially_applied'].includes(execution.status);

  const drawerProduct = products.find((pr) => pr.id === drawerPid) ?? null;

  return (
    <div className="flex flex-col gap-y-3">
      {/* Resumen + acciones */}
      <Container className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Heading>{execution.name}</Heading>
            <StatusBadge color={isActive ? 'blue' : execution.status === 'applied' ? 'green' : 'grey'}>
              {labelFor(EXECUTION_STATUS_LABELS, execution.status)}
            </StatusBadge>
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            {execution.selection_count} productos
            {p ? ` · ${p.processed}/${p.total} procesados (${p.percent}%)` : ''}
            {p && p.failed > 0 ? ` · ${p.failed} con error` : ''}
            {execution.applied_at ? ` · aplicada ${new Date(execution.applied_at).toLocaleString()}` : ''}
          </Text>
          <AiCostLine usage={execution.ai_usage} cost={execution.ai_cost_usd ?? 0} />
          {isActive && (
            <Text size="xsmall" className="text-ui-fg-muted">
              Procesando en segundo plano… actualizá la página para ver el avance.
            </Text>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {canGenerate && <Button size="small" onClick={() => act(() => generate.mutateAsync({ id }), 'Generación iniciada')}>Generar propuestas</Button>}
          {canApply && <Button size="small" variant="primary" onClick={() => act(() => apply.mutateAsync({ id }), 'Aplicación iniciada')}>Aplicar cambios</Button>}
          {canCancel && <Button size="small" variant="secondary" onClick={() => act(() => cancel.mutateAsync({ id }), 'Cancelada')}>Cancelar</Button>}
          <Button size="small" variant="secondary" onClick={() => act(() => duplicate.mutateAsync({ id }), 'Duplicada')}>Duplicar</Button>
          <Button size="small" variant="secondary" onClick={() => act(() => refloat.mutateAsync({ id, body: { use_current_config: true } }), 'Reflotada')}>Reflotar</Button>
          {canRestore && <Button size="small" variant="danger" onClick={() => act(() => restore.mutateAsync({ id }), 'Restauración creada')}>Restaurar</Button>}
          {/*
            Sólo aparece cuando SE PUEDE. Acá, a diferencia del menú del listado, un
            botón gris entre siete habilitados no informa: ocupa lugar y se lee como
            un bug. El listado es el que tiene que explicar por qué no se puede,
            porque es el que muestra todas las corridas juntas.
            `deletable` lo calcula el backend; esta pantalla no conoce la regla.
          */}
          {execution.deletable && (
            <Button size="small" variant="secondary" disabled={remove.isPending} onClick={handleDelete}>
              Eliminar
            </Button>
          )}
        </div>
      </Container>

      {/* Productos y cambios — tabla compacta (resumen + Revisar → Drawer) */}
      <Container className="flex flex-col gap-3">
        <Heading level="h2">Productos y cambios</Heading>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell className="min-w-[260px]">Producto</Table.HeaderCell>
                <Table.HeaderCell>Cambios</Table.HeaderCell>
                <Table.HeaderCell>Estado</Table.HeaderCell>
                <Table.HeaderCell>Acciones</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {products.map((prod) => {
                const fieldCount = Object.keys(prod.proposed_changes ?? {}).length;
                const imgCount = (assetsByProduct.get(prod.id) ?? []).length;
                const applied = prod.status === 'applied';
                return (
                  <Table.Row key={prod.id}>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        {prod.product_thumbnail ? (
                          <img src={prod.product_thumbnail} alt="" className="h-9 w-9 rounded object-cover" />
                        ) : (
                          <div className="h-9 w-9 rounded bg-ui-bg-subtle" />
                        )}
                        <div className="flex min-w-0 flex-col">
                          <span className="max-w-[220px] truncate text-sm">{prod.product_title ?? prod.product_id}</span>
                          {/* Sin esto, un conflicto o un apply fallido no se veían
                              en ninguna parte de la interfaz. */}
                          {messagesOf(prod.errors).map((m) => (
                            <Text key={m} size="xsmall" className="max-w-[260px] text-ui-fg-error">
                              {m}
                            </Text>
                          ))}
                          {messagesOf(prod.warnings).map((m) => (
                            <Text key={m} size="xsmall" className="max-w-[260px] text-ui-fg-subtle">
                              {m}
                            </Text>
                          ))}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-ui-fg-subtle text-xs">
                        {fieldCount > 0 ? `${fieldCount} campos` : 'sin campos'}
                        {imgCount > 0 ? ` · ${imgCount} imágenes` : ''}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <StatusBadge color={applied ? 'green' : prod.status === 'accepted' ? 'blue' : prod.status === 'error' || prod.status === 'apply_failed' ? 'red' : 'grey'}>
                        {labelFor(PRODUCT_STATUS_LABELS, prod.status)}
                      </StatusBadge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-1">
                        <Button size="small" variant="secondary" onClick={() => setDrawerPid(prod.id)}>
                          Revisar
                        </Button>
                        {!applied && (
                          <Button size="small" variant="transparent" onClick={() => act(() => reviewProduct.mutateAsync({ pid: prod.id, body: { action: 'exclude' } }), 'Excluido')}>
                            Excluir
                          </Button>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
              {products.length === 0 && (
                <Table.Row>
                  <Table.Cell>
                    <Text className="text-ui-fg-subtle">Sin productos.</Text>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      </Container>

      {/* Operaciones elegidas y su estado real. El detalle ya las devolvía y la UI
          no las pintaba en NINGUNA parte, así que la única forma de ver que seguían
          en `pending` era consultar la base. */}
      <OperationsPanel operations={operations} />

      {/* Actividad */}
      <Container className="flex flex-col gap-3">
        <Heading level="h2">Actividad</Heading>
        <div className="max-h-64 overflow-y-auto rounded-lg border p-3 text-sm">
          {activity.length === 0 && <Text className="text-ui-fg-subtle">Sin actividad.</Text>}
          {activity.map((a) => (
            <div key={a.id} className="flex items-center gap-2 border-b py-1">
              <span className="text-ui-fg-muted text-xs">{new Date(a.created_at).toLocaleString()}</span>
              <Badge size="2xsmall">{labelFor(ACTIVITY_LABELS, a.type)}</Badge>
              {activityDetail(a) && (
                <span className="text-ui-fg-subtle text-xs">{activityDetail(a)}</span>
              )}
            </div>
          ))}
        </div>
      </Container>

      {drawerProduct && (
        <ProductReviewDrawer
          key={drawerProduct.id}
          product={drawerProduct}
          assets={assetsByProduct.get(drawerProduct.id) ?? []}
          categoryNameById={categoryNameById}
          open={Boolean(drawerPid)}
          onClose={() => setDrawerPid(null)}
          onField={(body) => onFieldDecision(drawerProduct.id, body)}
          lowConfidenceThreshold={lowConfidenceThreshold}
          requireReviewLowConfidence={requireReviewLowConfidence}
          onAsset={(aid, decision) => reviewAsset.mutate({ aid, decision })}
          onAdjust={(asset) => setEditingAsset(asset)}
        />
      )}

      {editingAsset && (
        <EditableLifestyleEditor
          key={editingAsset.id}
          proposal={editingAsset}
          open={Boolean(editingAsset)}
          saving={updateComposition.isPending}
          onClose={() => setEditingAsset(null)}
          onSave={(composition) => updateComposition.mutateAsync({ aid: editingAsset.id, composition })}
        />
      )}
    </div>
  );
};

/**
 * Operaciones de la corrida con su estado.
 *
 * `cataloging_operation.status` nacía `pending` y nada lo movía nunca (ver
 * `setOperationsStatus` en el service). Este panel es la mitad visible de ese
 * arreglo: si vuelve a quedarse clavado en "Pendiente" con la corrida terminada,
 * se ve acá y no hay que ir a la base a descubrirlo.
 */
const OperationsPanel = ({ operations }: { operations: CatalogingOperation[] }) => {
  if (operations.length === 0) return null;
  const color = (status: string) =>
    status === 'done' ? 'green' : status === 'error' ? 'red' : status === 'running' ? 'blue' : 'grey';
  return (
    <Container className="flex flex-col gap-2">
      <Heading level="h2">Operaciones</Heading>
      <div className="flex flex-wrap gap-2">
        {operations.map((op) => (
          <div key={op.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1">
            <Text size="xsmall" className="text-ui-fg-base">
              {labelFor(FIELD_LABELS, op.field)}
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              {labelFor(OPERATION_TYPE_LABELS, op.type)}
            </Text>
            <StatusBadge color={color(op.status)}>
              {labelFor(OPERATION_STATUS_LABELS, op.status)}
            </StatusBadge>
          </div>
        ))}
      </div>
    </Container>
  );
};

const ProductReviewDrawer = ({
  product,
  assets,
  categoryNameById,
  open,
  onClose,
  onField,
  onAsset,
  onAdjust,
  lowConfidenceThreshold,
  requireReviewLowConfidence,
}: {
  product: CatalogingExecutionProduct;
  assets: CatalogingAssetProposal[];
  categoryNameById: Record<string, string>;
  open: boolean;
  onClose: () => void;
  onField: (body: Record<string, unknown>) => void;
  onAsset: (aid: string, decision: 'accept' | 'reject') => void;
  onAdjust: (asset: CatalogingAssetProposal) => void;
  /** Umbral real de la config, no el 0.7 de antes: es editable por el usuario. */
  lowConfidenceThreshold: number;
  requireReviewLowConfidence: boolean;
}) => {
  /** Muestra el valor de un campo; para categorías traduce los IDs a nombres. */
  const displayVal = (field: string, value: unknown): string =>
    field === 'categories' ? formatCategories(value, categoryNameById) : formatVal(value);
  const proposed = product.proposed_changes ?? {};
  const accepted = (product.accepted_changes ?? {}) as Record<string, unknown>;
  const snapshot = (product.current_snapshot ?? {}) as Record<string, unknown>;
  const fields = Object.keys(proposed);
  const applied = product.status === 'applied';

  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  // Confirmación de "usar la propuesta de la IA", que descarta una edición.
  const prompt = usePrompt();

  const tabDefs = [
    ...fields.map((f) => ({ id: f, label: `${FIELD_LABELS[f] ?? f}${f in accepted ? ' ✓' : ''}` })),
    ...(assets.length ? [{ id: 'images', label: 'Imágenes' }] : []),
  ];
  const firstTab = tabDefs[0]?.id ?? '';
  const [activeTab, setActiveTab] = useState(firstTab);
  const currentTab = tabDefs.some((t) => t.id === activeTab) ? activeTab : firstTab;

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <div className="flex w-full items-center justify-between gap-3">
            <Drawer.Title className="truncate">{product.product_title ?? product.product_id}</Drawer.Title>
            <Link to={`/products/${product.product_id}`} className="shrink-0">
              <Button size="small" variant="secondary">
                Ver producto
              </Button>
            </Link>
          </div>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto">
          <div className="pb-2">
            <AiCostLine usage={product.ai_usage} cost={product.ai_cost_usd ?? 0} />
          </div>
          {fields.length === 0 && assets.length === 0 ? (
            <Text className="text-ui-fg-subtle">Sin propuestas para este producto.</Text>
          ) : (
            <>
              <ReviewTabsBar tabs={tabDefs} tab={currentTab} setTab={setActiveTab} />

              {currentTab === 'images'
                ? (
                    <div className="py-2">
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                        {assets.map((a) => {
                          const isEditable = a.operation_type === 'lifestyle_editable';
                          const editMeta = isEditable ? readEditableMeta(a) : null;
                          const canAdjust = isEditable && a.status !== 'error' && Boolean(editMeta?.background?.url && editMeta?.product_layer?.url);
                          return (
                            <div key={a.id} className="flex flex-col gap-2 rounded-lg border p-2">
                              {isEditable && editMeta?.background?.url && editMeta?.product_layer?.url ? (
                                <CompositionPreview
                                  background={editMeta.background.url}
                                  product={editMeta.product_layer.url}
                                  composition={{
                                    x: editMeta.composition?.x ?? 0.7,
                                    y: editMeta.composition?.y ?? 0.75,
                                    scale: editMeta.composition?.scale ?? 0.25,
                                  }}
                                  className="rounded"
                                />
                              ) : (
                                <a href={a.generated_asset_id ?? '#'} target="_blank" rel="noreferrer" className="block">
                                  {a.generated_asset_id ? (
                                    <img src={a.generated_asset_id} alt="" className="h-40 w-full rounded object-contain" />
                                  ) : (
                                    <div className="flex h-40 w-full items-center justify-center rounded bg-ui-bg-subtle text-center text-[10px] text-ui-fg-muted">
                                      {a.status === 'error' ? 'No se pudo generar' : ''}
                                    </div>
                                  )}
                                </a>
                              )}
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge size="2xsmall" color={isEditable ? 'blue' : undefined}>
                                  {isEditable ? 'Lifestyle editable' : a.operation_type}
                                </Badge>
                                {a.is_ai_generated && !isEditable && (
                                  <Badge size="2xsmall" color="purple">
                                    IA
                                  </Badge>
                                )}
                                <span className="ml-auto text-[10px] text-ui-fg-muted">{labelFor(ASSET_STATUS_LABELS, a.status)}</span>
                              </div>
                              <TechnicalDelta metadata={a.metadata as Record<string, unknown> | null} />
                              {a.status === 'error' && typeof (a.metadata as { error?: unknown } | null)?.error === 'string' && (
                                <Text size="xsmall" className="text-ui-fg-error">
                                  {String((a.metadata as { error?: unknown }).error)}
                                </Text>
                              )}
                              {!applied && a.status !== 'error' && (
                                <div className="flex flex-wrap gap-1">
                                  {canAdjust && (
                                    <Button size="small" variant="secondary" onClick={() => onAdjust(a)}>
                                      Ajustar
                                    </Button>
                                  )}
                                  <Button size="small" variant={a.status === 'accepted' ? 'primary' : 'secondary'} onClick={() => onAsset(a.id, 'accept')}>
                                    {a.status === 'accepted' ? 'Elegida' : 'Elegir'}
                                  </Button>
                                  <Button size="small" variant="transparent" onClick={() => onAsset(a.id, 'reject')}>
                                    Descartar
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <Text size="xsmall" className="mt-2 text-ui-fg-muted">
                        Clic en una imagen para verla en tamaño completo.
                      </Text>
                    </div>
                  )
                : (() => {
                    const f = currentTab;
                    const prop = proposed[f];
                    const editable = FREETEXT_FIELDS.includes(f);
                    const isEditing = editField === f;
                    /*
                      El valor que el APPLY va a escribir: la decisión del usuario le
                      gana a la propuesta. Mostrar `prop.value` a secas era el bug
                      reportado — la regla, y el porqué, viven en `./lib.ts` con tests.
                    */
                    const { effective, shownText, aiText, isAccepted, isEdited } = resolveProposalView({
                      field: f,
                      proposed: proposed as Record<string, Proposal>,
                      accepted,
                      format: displayVal,
                    });
                    return (
                      <div className="flex flex-col gap-4 py-2">
                        <div className="flex flex-col gap-1">
                          <Text size="xsmall" weight="plus" className="text-ui-fg-muted">
                            Actual
                          </Text>
                          <div className="rounded-lg border bg-ui-bg-subtle p-2 text-sm">{displayVal(f, snapshot[f])}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Text size="xsmall" weight="plus" className="text-ui-fg-muted">
                              {isEdited ? 'Tu edición' : 'Propuesta'}
                            </Text>
                            {isEdited && (
                              <Badge size="2xsmall" color="blue">
                                Editado
                              </Badge>
                            )}
                            {/*
                              Los badges de confianza describen a la propuesta de la IA,
                              no a lo que escribió el humano. Con el campo editado bajan
                              al bloque de la propuesta original: dejar "Requiere
                              revisión" al lado del texto propio decía que falta revisar
                              algo que la persona acaba de escribir.
                            */}
                            {!isEdited && typeof prop?.confidence === 'number' && (
                              <Badge
                                size="2xsmall"
                                color={prop.confidence < lowConfidenceThreshold ? 'orange' : 'green'}
                              >
                                Confianza {pct(prop.confidence)}
                              </Badge>
                            )}
                            {!isEdited &&
                              typeof prop?.confidence === 'number' &&
                              prop.confidence < lowConfidenceThreshold &&
                              requireReviewLowConfidence && (
                                <Badge size="2xsmall" color="orange">
                                  Requiere revisión (umbral {pct(lowConfidenceThreshold)})
                                </Badge>
                              )}
                          </div>
                          {isEditing ? (
                            <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={5} />
                          ) : (
                            <div className={`whitespace-pre-wrap rounded-lg border p-2 text-sm ${isAccepted ? 'bg-ui-tag-green-bg ring-1 ring-ui-tag-green-border' : ''}`}>
                              {shownText}
                            </div>
                          )}
                        </div>
                        {/*
                          Con el campo editado, la propuesta de la IA sigue a la vista
                          pero abajo y en gris: es el histórico contra el que la persona
                          compara, y es lo que el botón de descartar devuelve.
                        */}
                        {isEdited && !isEditing && (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Text size="xsmall" weight="plus" className="text-ui-fg-muted">
                                Propuesta original de la IA
                              </Text>
                              {typeof prop?.confidence === 'number' && (
                                <Badge
                                  size="2xsmall"
                                  color={prop.confidence < lowConfidenceThreshold ? 'orange' : 'green'}
                                >
                                  Confianza {pct(prop.confidence)}
                                </Badge>
                              )}
                            </div>
                            <div className="whitespace-pre-wrap rounded-lg border border-dashed p-2 text-sm text-ui-fg-subtle">
                              {aiText}
                            </div>
                          </div>
                        )}
                        {!applied && (
                          <div className="flex gap-2">
                            {isEditing ? (
                              <>
                                <Button
                                  size="small"
                                  onClick={() => {
                                    onField({ action: 'field', field: f, decision: 'edit', value: editValue });
                                    setEditField(null);
                                  }}
                                >
                                  Guardar
                                </Button>
                                <Button size="small" variant="transparent" onClick={() => setEditField(null)}>
                                  Cancelar
                                </Button>
                              </>
                            ) : (
                              <>
                                {/*
                                  Con el campo editado, "Aceptar" NO se ofrece como un
                                  botón más: `decision: 'accept'` hace
                                  `accepted[f] = proposed[f].value` y pisa la edición con
                                  el texto de la IA, sin aviso. Antes decía "Aceptado" en
                                  primary —o sea, se leía como el estado actual— y un
                                  click de más borraba el trabajo. Ahora es una acción
                                  explícita, con nombre y con confirmación.
                                */}
                                {isEdited ? (
                                  <Button
                                    size="small"
                                    variant="transparent"
                                    onClick={async () => {
                                      const ok = await prompt({
                                        title: 'Descartar tu edición',
                                        description:
                                          'Se reemplaza tu texto por la propuesta original de la IA. Tu edición se pierde.',
                                        confirmText: 'Descartar mi edición',
                                        cancelText: 'Cancelar',
                                      });
                                      if (!ok) return;
                                      onField({ action: 'field', field: f, decision: 'accept' });
                                    }}
                                  >
                                    Usar la propuesta de la IA
                                  </Button>
                                ) : (
                                  <Button size="small" variant={isAccepted ? 'primary' : 'secondary'} onClick={() => onField({ action: 'field', field: f, decision: 'accept' })}>
                                    {isAccepted ? 'Aceptado' : 'Aceptar'}
                                  </Button>
                                )}
                                <Button size="small" variant="transparent" onClick={() => onField({ action: 'field', field: f, decision: 'reject' })}>
                                  Rechazar
                                </Button>
                                {editable && (
                                  <Button
                                    size="small"
                                    variant={isEdited ? 'secondary' : 'transparent'}
                                    onClick={() => {
                                      setEditField(f);
                                      // Arranca del valor EFECTIVO, no del de la IA:
                                      // partir de `prop.value` hacía que reeditar un
                                      // campo ya editado descartara la edición anterior
                                      // en cuanto se apretaba Guardar.
                                      setEditValue(String((effective as string) ?? ''));
                                    }}
                                  >
                                    Editar
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
            </>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex w-full items-center justify-end gap-2">
            {!applied && (
              <>
                <Button size="small" variant="secondary" onClick={() => onField({ action: 'reject_all' })}>
                  Rechazar todo
                </Button>
                <Button size="small" onClick={() => onField({ action: 'accept_all' })}>
                  Aceptar todo
                </Button>
              </>
            )}
            <Button size="small" variant="transparent" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

/** Barra de tabs horizontal scrolleable con chevrons (mismo patrón que el drawer de B2B). */
const ReviewTabsBar = ({
  tabs,
  tab,
  setTab,
}: {
  tabs: Array<{ id: string; label: string }>;
  tab: string;
  setTab: (id: string) => void;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    sync();
    const onResize = () => sync();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [tabs.length]);

  const nudge = (dir: -1 | 1) => ref.current?.scrollBy({ left: dir * 180, behavior: 'smooth' });

  return (
    <div className="relative mb-4 border-ui-border-base border-b">
      {canLeft ? (
        <button
          type="button"
          aria-label="Tabs anteriores"
          onClick={() => nudge(-1)}
          className="absolute inset-y-0 left-0 z-10 flex items-center bg-gradient-to-r from-ui-bg-base via-ui-bg-base to-transparent pr-6 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
        >
          <ChevronLeftMini />
        </button>
      ) : null}
      <div
        ref={ref}
        onScroll={sync}
        className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tDef) => (
          <button
            key={tDef.id}
            type="button"
            onClick={(e) => {
              setTab(tDef.id);
              e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm ${
              tab === tDef.id ? 'border-ui-fg-base border-b-2 font-medium text-ui-fg-base' : 'text-ui-fg-subtle'
            }`}
          >
            {tDef.label}
          </button>
        ))}
      </div>
      {canRight ? (
        <button
          type="button"
          aria-label="Tabs siguientes"
          onClick={() => nudge(1)}
          className="absolute inset-y-0 right-0 z-10 flex items-center bg-gradient-to-l from-ui-bg-base via-ui-bg-base to-transparent pl-6 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
        >
          <ChevronRightMini />
        </button>
      ) : null}
    </div>
  );
};

function formatVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Categorías: el valor viene como IDs (`pcat_...`) en array o string separado por
 * comas. Los traducimos al nombre de la categoría; si no está en el mapa (aún
 * cargando o inexistente) dejamos el ID como fallback.
 */
function formatCategories(v: unknown, nameById: Record<string, string>): string {
  if (v === null || v === undefined || v === '') return '—';
  const ids = (Array.isArray(v) ? v : String(v).split(','))
    .map((x) => String(x).trim())
    .filter(Boolean);
  if (ids.length === 0) return '—';
  return ids.map((id) => nameById[id] ?? id).join(', ');
}

export default ExecutionDetail;
