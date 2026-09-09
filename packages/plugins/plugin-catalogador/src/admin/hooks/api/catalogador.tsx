import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../lib/client';
import { queryKeysFactory } from '../../lib/query-key-factory';
import { toQueryString } from '../../lib/query-string';

// ---------------------------------------------------------------------------
// Tipos (espejo liviano de las entidades del backend, sólo lo que usa la UI).
// ---------------------------------------------------------------------------
export type CatalogingExecutionStatus =
  | 'draft'
  | 'generating'
  | 'pending_review'
  | 'partially_reviewed'
  | 'ready_to_apply'
  | 'applying'
  | 'applied'
  | 'partially_applied'
  | 'error'
  | 'cancelled'
  | 'restored';

export interface ExecutionProgress {
  total: number;
  processed: number;
  proposed: number;
  no_changes: number;
  warnings: number;
  failed: number;
  percent: number;
}

/** Costo/consumo de OpenRouter imputado a una ejecución o a un producto. */
export interface AiUsageBreakdown {
  total_usd: number;
  text_usd: number;
  image_usd: number;
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  by_model: Record<string, { calls: number; usd: number }>;
  /** true si alguna llamada no informó costo: el total es un piso. */
  missing_cost: boolean;
}

export interface CatalogingExecution {
  id: string;
  name: string;
  status: CatalogingExecutionStatus;
  kind: 'enrichment' | 'restoration';
  created_by: string | null;
  selection_count: number;
  progress: ExecutionProgress | null;
  ai_cost_usd: number;
  ai_usage: AiUsageBreakdown | null;
  summary: Record<string, unknown> | null;
  error_summary: Record<string, unknown> | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
  /** Cuándo se mandó a la papelera. `null` en el listado normal. */
  deleted_at: string | null;
  /**
   * ¿Se puede mandar a la papelera? Lo calcula el BACKEND por fila (la regla vive
   * en `modules/catalogador/deletable.ts`). La UI no tiene su propia lista de
   * estados: el día que uno cambie de lado, el menú cambia solo.
   */
  deletable?: boolean;
  /** Por qué no se puede, para mostrarlo. `null` cuando sí se puede. */
  delete_block_reason?: string | null;
  restored_from_execution_id: string | null;
}

export interface CatalogingExecutionProduct {
  id: string;
  execution_id: string;
  product_id: string;
  status: string;
  current_snapshot: Record<string, unknown> | null;
  proposed_changes: Record<string, { value: unknown; confidence: number | null; source_trace?: Record<string, boolean>; warnings?: string[] }> | null;
  accepted_changes: Record<string, unknown> | null;
  rejected_changes: Record<string, unknown> | null;
  warnings: unknown;
  errors: unknown;
  external_context_summary: Record<string, unknown> | null;
  generation_attempts: number;
  ai_cost_usd: number;
  ai_usage: AiUsageBreakdown | null;
  /** Adjuntados por el detalle para la tabla de validación. */
  product_title?: string | null;
  product_thumbnail?: string | null;
  product_handle?: string | null;
}

export interface CatalogingAssetProposal {
  id: string;
  execution_product_id: string;
  source_asset_id: string | null;
  generated_asset_id: string | null;
  operation_type: string;
  status: string;
  is_ai_generated: boolean;
  metadata: Record<string, unknown> | null;
}

export interface CatalogingActivity {
  id: string;
  execution_id: string;
  execution_product_id: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CatalogingOperation {
  id: string;
  type: 'text_field' | 'image_technical' | 'image_ai';
  field: string;
  /**
   * El detalle ya devolvía las operaciones y este tipo no declaraba su `status`,
   * así que la UI no podía mostrarlo ni aunque quisiera.
   */
  status: 'pending' | 'running' | 'done' | 'error';
}

interface ExecutionsListResponse {
  executions: CatalogingExecution[];
  count: number;
  offset: number;
  limit: number;
  /** true cuando la respuesta es la papelera (`?deleted=only`). */
  deleted?: boolean;
}
interface ExecutionDetailResponse {
  execution: CatalogingExecution;
  products: CatalogingExecutionProduct[];
  operations: CatalogingOperation[];
  activity: CatalogingActivity[];
  asset_proposals: CatalogingAssetProposal[];
}

export const catalogadorQueryKey = queryKeysFactory('catalogador');

// ---------------------------------------------------------------------------
// Ejecuciones
// ---------------------------------------------------------------------------
export const useExecutions = (query?: Record<string, unknown>) => {
  const qs = toQueryString(query);
  return useQuery({
    queryKey: catalogadorQueryKey.list(query),
    queryFn: () =>
      sdk.client.fetch<ExecutionsListResponse>(`/admin/catalogador/executions${qs ? `?${qs}` : ''}`, {
        method: 'GET',
      }),
  });
};

export const useExecution = (id: string, enabled = true) =>
  useQuery({
    queryKey: catalogadorQueryKey.detail(id),
    enabled: Boolean(id) && enabled,
    queryFn: () =>
      sdk.client.fetch<ExecutionDetailResponse>(`/admin/catalogador/executions/${id}`, { method: 'GET' }),
  });

export const useCreateExecution = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch<{ execution: CatalogingExecution }>('/admin/catalogador/executions', {
        method: 'POST',
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogadorQueryKey.lists() }),
  });
};

/** Borrado LÓGICO: la manda a la papelera, de donde `useUndeleteExecution` la trae. */
export const useDeleteExecution = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{ id: string; deleted: boolean }>(
        `/admin/catalogador/executions/${id}`,
        { method: 'DELETE' }
      ),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: catalogadorQueryKey.lists() });
      qc.invalidateQueries({ queryKey: catalogadorQueryKey.detail(id) });
    },
  });
};

/** Acción de ciclo de vida genérica (generate/apply/cancel/duplicate/refloat/restore). */
function useExecutionAction(action: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      sdk.client.fetch<{ execution: CatalogingExecution }>(
        `/admin/catalogador/executions/${id}/${action}`,
        { method: 'POST', body: body ?? {} }
      ),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: catalogadorQueryKey.lists() });
      qc.invalidateQueries({ queryKey: catalogadorQueryKey.detail(vars.id) });
    },
  });
}

export const useGenerateExecution = () => useExecutionAction('generate');
export const useApplyExecution = () => useExecutionAction('apply');
export const useCancelExecution = () => useExecutionAction('cancel');
export const useDuplicateExecution = () => useExecutionAction('duplicate');
export const useRefloatExecution = () => useExecutionAction('refloat');
export const useRestoreExecution = () => useExecutionAction('restore');
/**
 * Saca de la papelera. OJO con el vecino: `useRestoreExecution` NO es esto — crea
 * una corrida que reescribe el catálogo con los valores previos.
 */
export const useUndeleteExecution = () => useExecutionAction('undelete');

// ---------------------------------------------------------------------------
// Revisión por producto / imagen
// ---------------------------------------------------------------------------
/**
 * Campos que "aceptar todo" NO auto-aceptó porque su confianza quedó por debajo
 * del umbral configurado. Viene tipado porque la UI tiene que avisarlo: sin eso
 * el usuario ve un 200 sin cambios y parece que el botón no hace nada.
 */
export interface DeferredLowConfidence {
  count: number;
  fields: Array<{ field: string; confidence: number }>;
  threshold: number;
}
export interface ReviewProductResponse {
  product: CatalogingExecutionProduct;
  /** null cuando no se difirió ningún campo. */
  deferred_low_confidence: DeferredLowConfidence | null;
}

export const useReviewProduct = (executionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pid, body }: { pid: string; body: Record<string, unknown> }) =>
      sdk.client.fetch<ReviewProductResponse>(
        `/admin/catalogador/executions/${executionId}/products/${pid}`,
        { method: 'POST', body }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogadorQueryKey.detail(executionId) }),
  });
};

export const useReviewAsset = (executionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ aid, decision }: { aid: string; decision: 'accept' | 'reject' }) =>
      sdk.client.fetch(`/admin/catalogador/executions/${executionId}/assets/${aid}`, {
        method: 'POST',
        body: { decision },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogadorQueryKey.detail(executionId) }),
  });
};

/** Composición del lifestyle editable (PRD §10): sólo persiste metadata. */
export interface EditableComposition {
  x: number;
  y: number;
  scale: number;
}
export const useUpdateComposition = (executionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ aid, composition }: { aid: string; composition: EditableComposition }) =>
      sdk.client.fetch<{ asset_proposal: CatalogingAssetProposal }>(
        `/admin/catalogador/executions/${executionId}/assets/${aid}/composition`,
        { method: 'PATCH', body: composition }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogadorQueryKey.detail(executionId) }),
  });
};

// ---------------------------------------------------------------------------
// Selección de productos (preview)
// ---------------------------------------------------------------------------
export interface SelectionPreviewResult {
  count: number;
  approximate: boolean;
  sample: Array<{ id: string; title: string; status: string; thumbnail: string | null }>;
  warning: string | null;
}
export const useSelectionPreview = () =>
  useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch<SelectionPreviewResult>('/admin/catalogador/selection/preview', {
        method: 'POST',
        body,
      }),
  });

// ---------------------------------------------------------------------------
// Productos (para la selección estilo Listas de Precios: DataTable server-side)
// ---------------------------------------------------------------------------
export interface AdminProductRow {
  id: string;
  title: string;
  thumbnail: string | null;
  status: string;
  collection?: { title?: string } | null;
  variants?: Array<{ id: string }>;
}
interface AdminProductsResponse {
  products: AdminProductRow[];
  count: number;
  offset: number;
  limit: number;
}
export const useAdminProducts = (query: Record<string, unknown>) => {
  const qs = toQueryString({ ...query, fields: 'id,title,thumbnail,status,*collection,variants.id' });
  return useQuery({
    queryKey: [...catalogadorQueryKey.all, 'products', query],
    queryFn: () =>
      sdk.client.fetch<AdminProductsResponse>(`/admin/products${qs ? `?${qs}` : ''}`, { method: 'GET' }),
  });
};

// Listas para los filtros del selector de productos (categorías/colecciones/tags).
export const useAdminCategories = () =>
  useQuery({
    queryKey: [...catalogadorQueryKey.all, 'product-categories'],
    queryFn: () =>
      sdk.client.fetch<{ product_categories: Array<{ id: string; name: string }> }>(
        '/admin/product-categories?limit=500&fields=id,name',
        { method: 'GET' }
      ),
  });
export const useAdminCollections = () =>
  useQuery({
    queryKey: [...catalogadorQueryKey.all, 'collections'],
    queryFn: () =>
      sdk.client.fetch<{ collections: Array<{ id: string; title: string }> }>(
        '/admin/collections?limit=500&fields=id,title',
        { method: 'GET' }
      ),
  });
export const useAdminTags = () =>
  useQuery({
    queryKey: [...catalogadorQueryKey.all, 'product-tags'],
    queryFn: () =>
      sdk.client.fetch<{ product_tags: Array<{ id: string; value: string }> }>(
        '/admin/product-tags?limit=500&fields=id,value',
        { method: 'GET' }
      ),
  });

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
export const useCatalogadorConfig = () =>
  useQuery({
    queryKey: [...catalogadorQueryKey.all, 'config'],
    queryFn: () =>
      sdk.client.fetch<{ config: Record<string, unknown> }>('/admin/catalogador/config', { method: 'GET' }),
  });

export const useUpdateCatalogadorConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch<{ config: Record<string, unknown> }>('/admin/catalogador/config', {
        method: 'POST',
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...catalogadorQueryKey.all, 'config'] }),
  });
};
