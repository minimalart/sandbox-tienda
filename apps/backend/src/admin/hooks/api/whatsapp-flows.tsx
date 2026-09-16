import type { FetchError } from '@medusajs/js-sdk';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';

import { sdk } from '../../lib/client';

export type FlowIssue = { nodeId?: string; edgeId?: string; message: string };

export type FlowVersionSummary = {
  id: string;
  flow_key: string;
  site_id: string | null;
  status: 'draft' | 'ready' | 'active' | 'superseded';
  version: number;
  name: string | null;
  notes: string | null;
  published_at: string | null;
  published_by: string | null;
  updated_at: string;
};

export type FlowVersion = FlowVersionSummary & {
  graph: { nodes: unknown[]; edges: unknown[] };
  metadata?: { exclusive?: boolean } | null;
};

/** Una fila de la tabla de recorridos: sin el grafo, con lo que se lee de un vistazo. */
export type FlowListRow = FlowVersionSummary & {
  steps: number;
  problems: number;
};

export type WhatsappFlowsResponse = {
  flow_key: string;
  site_id: string | null;
  active: FlowVersion | null;
  /** Los recorridos en armado. Son varios desde que el editor es un ABM. */
  drafts: FlowListRow[];
  versions: FlowVersionSummary[];
};

export type SaveFlowInput = {
  /** Cuál borrador se guarda. Sin id se CREA uno nuevo. */
  version_id?: string | null;
  graph: { nodes: unknown[]; edges: unknown[] };
  name?: string;
  notes?: string;
};

export type PublishFlowInput = {
  /** Cuál borrador pasa a atender. Sin id sólo funciona si hay uno solo. */
  version_id?: string | null;
  /** `true` = este recorrido atiende TODO: no se cae al bot viejo ni al modelo. */
  exclusive?: boolean;
  /** Qué cambió. Es lo que después deja entender el historial de versiones. */
  notes?: string;
};

export const whatsappFlowsQueryKey = {
  all: ['whatsapp-flows'] as const,
};

export const useWhatsappFlows = (
  options?: UseQueryOptions<WhatsappFlowsResponse, FetchError, WhatsappFlowsResponse, QueryKey>,
) =>
  useQuery({
    queryKey: whatsappFlowsQueryKey.all,
    queryFn: () => sdk.client.fetch<WhatsappFlowsResponse>('/admin/whatsapp-flows', { method: 'GET' }),
    ...options,
  });

export const useSaveWhatsappFlow = (
  options?: UseMutationOptions<{ draft: FlowVersion; issues: FlowIssue[] }, FetchError, SaveFlowInput>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveFlowInput) =>
      sdk.client.fetch<{ draft: FlowVersion; issues: FlowIssue[] }>('/admin/whatsapp-flows', {
        method: 'POST',
        body,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: whatsappFlowsQueryKey.all }),
    ...options,
  });
};

export const usePublishWhatsappFlow = (
  options?: UseMutationOptions<
    { activated_version_id: string; active: FlowVersion | null },
    FetchError,
    PublishFlowInput
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PublishFlowInput) =>
      sdk.client.fetch<{ activated_version_id: string; active: FlowVersion | null }>(
        '/admin/whatsapp-flows/publish',
        { method: 'POST', body },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: whatsappFlowsQueryKey.all }),
    ...options,
  });
};

/**
 * Crea un recorrido nuevo a partir del que el bot atiende hoy.
 *
 * Es una de las dos formas de empezar desde la tabla; la otra es en blanco. Crea SIEMPRE
 * uno nuevo: desde que pueden convivir varios borradores, no pisa nada.
 */
export const useSeedWhatsappFlow = (
  options?: UseMutationOptions<{ draft: FlowVersion; issues: FlowIssue[] }, FetchError, void>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ draft: FlowVersion; issues: FlowIssue[] }>('/admin/whatsapp-flows/seed', {
        method: 'POST',
        body: {},
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: whatsappFlowsQueryKey.all }),
    ...options,
  });
};

/**
 * Borra un borrador.
 *
 * Sólo borradores: el publicado está atendiendo clientes y una versión vieja es el
 * registro de lo que atendió. La ruta lo rechaza igual — acá no se confía en que la
 * pantalla no ofrezca el botón.
 */
export const useDeleteWhatsappFlowDraft = (
  options?: UseMutationOptions<{ id: string; deleted: boolean }, FetchError, string>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{ id: string; deleted: boolean }>(`/admin/whatsapp-flows/versions/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: whatsappFlowsQueryKey.all }),
    ...options,
  });
};

// ─── Versiones y métricas ─────────────────────────────────────────────────────

export type FlowVersionDetail = FlowVersionSummary & {
  graph: { nodes: unknown[]; edges: unknown[] };
  metadata?: { exclusive?: boolean } | null;
};

/**
 * Una versión con su grafo.
 *
 * El listado de `GET /admin/whatsapp-flows` las devuelve SIN grafo a propósito —cada
 * uno puede pesar cientos de KB y son hasta 50—, así que para mirar una vieja o
 * restaurarla hay que pedirla por id.
 */
export const useWhatsappFlowVersion = (
  id: string | null,
  options?: Omit<
    UseQueryOptions<{ version: FlowVersionDetail }, FetchError, { version: FlowVersionDetail }, QueryKey>,
    'queryKey' | 'queryFn'
  >,
) =>
  useQuery({
    queryKey: ['whatsapp-flows', 'version', id] as const,
    queryFn: () =>
      sdk.client.fetch<{ version: FlowVersionDetail }>(`/admin/whatsapp-flows/versions/${id}`, {
        method: 'GET',
      }),
    enabled: Boolean(id),
    ...options,
  });

/**
 * Copia una versión vieja a un borrador NUEVO. No publica: deja que alguien la mire
 * antes, y no pisa lo que se esté editando.
 */
export const useRestoreWhatsappFlowVersion = (
  options?: UseMutationOptions<{ draft: FlowVersion; issues: FlowIssue[] }, FetchError, { id: string }>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      sdk.client.fetch<{ draft: FlowVersion; issues: FlowIssue[] }>(
        `/admin/whatsapp-flows/versions/${id}/restore`,
        { method: 'POST', body: {} },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: whatsappFlowsQueryKey.all }),
    ...options,
  });
};

export type FlowAnalyticsResponse =
  | { available: false; reason: string }
  | {
      available: true;
      days: number;
      since: string;
      version_id: string;
      rows_read: number;
      truncated: boolean;
      sessions_total: number;
      nodes: Record<string, { sessions: number; dropped: number }>;
      edges: Record<string, { sessions: number; percent_of_source: number; ambiguous?: boolean }>;
    };

/** Por dónde pasan las conversaciones reales. Se mide contra la versión ACTIVA. */
export const useWhatsappFlowAnalytics = (
  days: number,
  enabled: boolean,
  options?: Omit<
    UseQueryOptions<FlowAnalyticsResponse, FetchError, FlowAnalyticsResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >,
) =>
  useQuery({
    queryKey: ['whatsapp-flows', 'analytics', days] as const,
    queryFn: () =>
      sdk.client.fetch<FlowAnalyticsResponse>(`/admin/whatsapp-flows/analytics?days=${days}`, {
        method: 'GET',
      }),
    enabled,
    ...options,
  });
