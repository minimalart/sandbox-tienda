import { FetchError } from '@medusajs/js-sdk';
import {
  QueryKey,
  useMutation,
  UseMutationOptions,
  useQuery,
  UseQueryOptions,
  useQueryClient,
} from '@tanstack/react-query';
import { sdk } from '../../lib/client';

/** Config del asesor guiado de WhatsApp (`store_setting whatsapp_advisor_config`). */
export interface AdvisorConfigResponse {
  config: {
    max_results: number;
    show_threshold: number;
    max_questions: number;
    rules: {
      version: number;
      category_external_id_prefix: string;
      by_category_code: Record<string, Record<string, string[]>>;
      by_family: Record<string, Record<string, string[]>>;
      by_title_keyword: Array<{ match: string[]; set: Record<string, string[]> }>;
      fill_unknown: string[];
      unknown_value: string;
    };
  };
}

export interface AdvisorAuditResponse {
  total: number;
  sales_channel_id: string | null;
  rules_version: number;
  coverage: Record<
    string,
    { measured: boolean; known?: number; unknown?: number; percent?: number; assigned?: number }
  >;
  counts: Record<string, Record<string, number>>;
  unmapped_categories: Array<{ code: string; name: string; products: number }>;
  unmapped_families: Array<{ name: string; products: number }>;
  samples: Record<string, string[]>;
}

export interface WhatsappFunnelResponse {
  available: boolean;
  reason?: string;
  days?: number;
  sessions?: number;
  legacy_sessions?: number;
  truncated?: boolean;
  funnel?: Array<{ key: string; label: string; sessions: number; percent_of_total: number }>;
  kpi?: { commercial_sessions: number; checkout_sessions: number; checkout_rate: number };
  without_ai?: { sessions: number; percent: number };
  no_results?: number;
  handoffs?: number;
  errors?: number;
  relaxed?: number;
  /** Mensajes que el bot NO contestó por estar la conversación en atención manual. */
  paused_drops?: number;
  abandoned_by_step?: Record<string, number>;
}

export const whatsappAdvisorQueryKey = {
  config: ['whatsapp-advisor', 'config'] as const,
  audit: (channelId?: string) => ['whatsapp-advisor', 'audit', channelId ?? 'all'] as const,
  funnel: (days: number) => ['whatsapp-advisor', 'funnel', days] as const,
};

export const useAdvisorConfig = (
  options?: UseQueryOptions<AdvisorConfigResponse, FetchError, AdvisorConfigResponse, QueryKey>,
) =>
  useQuery({
    queryKey: whatsappAdvisorQueryKey.config,
    queryFn: async () =>
      sdk.client.fetch<AdvisorConfigResponse>('/admin/whatsapp-advisor/config', { method: 'GET' }),
    ...options,
  });

/**
 * Guarda la config, o carga el vocabulario por defecto con `{ seed: true }`.
 * Cualquiera de las dos exige re-sincronizar Typesense después.
 */
export const useSaveAdvisorConfig = (
  options?: UseMutationOptions<AdvisorConfigResponse, FetchError, Record<string, unknown>>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch<AdvisorConfigResponse>('/admin/whatsapp-advisor/config', {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappAdvisorQueryKey.config });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-advisor', 'audit'] });
    },
    ...options,
  });
};

/** Auditoría de cobertura: se pide a demanda, no al abrir la página (recorre el catálogo). */
export const useAdvisorAudit = (
  channelId?: string,
  options?: UseQueryOptions<AdvisorAuditResponse, FetchError, AdvisorAuditResponse, QueryKey>,
) =>
  useQuery({
    queryKey: whatsappAdvisorQueryKey.audit(channelId),
    queryFn: async () =>
      sdk.client.fetch<AdvisorAuditResponse>('/admin/whatsapp-advisor/audit', {
        method: 'GET',
        query: channelId ? { sales_channel_id: channelId } : undefined,
      }),
    enabled: false,
    ...options,
  });

export const useWhatsappFunnel = (
  days: number,
  options?: UseQueryOptions<WhatsappFunnelResponse, FetchError, WhatsappFunnelResponse, QueryKey>,
) =>
  useQuery({
    queryKey: whatsappAdvisorQueryKey.funnel(days),
    queryFn: async () =>
      sdk.client.fetch<WhatsappFunnelResponse>('/admin/whatsapp-analytics', {
        method: 'GET',
        query: { days },
      }),
    ...options,
  });
