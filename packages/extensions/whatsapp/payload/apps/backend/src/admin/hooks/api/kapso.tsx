import { FetchError } from '@medusajs/js-sdk';
import {
  QueryKey,
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query';
import { sdk } from '../../lib/client';

export interface KapsoInboxEmbedResponse {
  embed_url: string | null;
}

export interface KapsoTemplate {
  id?: string;
  name: string;
  language: string;
  category: string;
  status?: string;
  components?: Array<Record<string, unknown>>;
}

export interface KapsoTemplatesResponse {
  templates: KapsoTemplate[];
  count: number;
}

export interface CreateKapsoTemplate {
  name: string;
  language: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  components: Array<Record<string, unknown>>;
}

export interface UpdateKapsoTemplate {
  /** Nombre (para la URL / referencia). */
  name: string;
  /** Id de la plantilla en Meta (obligatorio: Meta edita por id, no por nombre). */
  id: string;
  category?: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  components?: Array<Record<string, unknown>>;
}

export interface KapsoBinding {
  template_name: string;
  language: string;
  params: string[];
  status: 'draft' | 'published';
}

export type KapsoBindingsMap = Record<string, KapsoBinding>;

export interface KapsoBindingsResponse {
  bindings: KapsoBindingsMap;
}

export interface SaveKapsoBinding {
  key: string;
  template_name: string;
  language: string;
  params: string[];
  status: 'draft' | 'published';
}

/** Config del botón flotante de WhatsApp del storefront. */
export interface KapsoFloatingButton {
  enabled: boolean;
  /** Teléfono normalizado (solo dígitos, sin `+`). */
  phone: string;
  message: string;
  label: string;
}

export interface KapsoFloatingButtonResponse {
  floating_button: KapsoFloatingButton;
  /** true si el botón se ve en la tienda (activado + teléfono válido). */
  live: boolean;
}

export type UpdateKapsoFloatingButton = Partial<KapsoFloatingButton>;

export const kapsoQueryKey = {
  all: ['kapso'] as const,
  inboxEmbed: () => [...kapsoQueryKey.all, 'inbox-embed'] as const,
  templates: () => [...kapsoQueryKey.all, 'templates'] as const,
  bindings: () => [...kapsoQueryKey.all, 'bindings'] as const,
  floatingButton: () => [...kapsoQueryKey.all, 'floating-button'] as const,
  botChannels: () => [...kapsoQueryKey.all, 'bot-channels'] as const,
};

export const useKapsoInboxEmbed = (
  options?: UseQueryOptions<
    KapsoInboxEmbedResponse,
    FetchError,
    KapsoInboxEmbedResponse,
    QueryKey
  >,
) =>
  useQuery({
    queryKey: kapsoQueryKey.inboxEmbed(),
    queryFn: async () =>
      sdk.client.fetch<KapsoInboxEmbedResponse>('/admin/kapso/inbox-embed', {
        method: 'GET',
      }),
    ...options,
  });

export const useKapsoTemplates = (
  options?: UseQueryOptions<
    KapsoTemplatesResponse,
    FetchError,
    KapsoTemplatesResponse,
    QueryKey
  >,
) =>
  useQuery({
    queryKey: kapsoQueryKey.templates(),
    queryFn: async () =>
      sdk.client.fetch<KapsoTemplatesResponse>('/admin/kapso/templates', {
        method: 'GET',
      }),
    ...options,
  });

export const useCreateKapsoTemplate = (
  options?: UseMutationOptions<
    { template: KapsoTemplate },
    FetchError,
    CreateKapsoTemplate
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateKapsoTemplate) =>
      sdk.client.fetch<{ template: KapsoTemplate }>('/admin/kapso/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: kapsoQueryKey.templates() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useUpdateKapsoTemplate = (
  options?: UseMutationOptions<
    { updated: boolean; name: string; result: unknown },
    FetchError,
    UpdateKapsoTemplate
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, ...body }: UpdateKapsoTemplate) =>
      sdk.client.fetch<{ updated: boolean; name: string; result: unknown }>(
        `/admin/kapso/templates/${encodeURIComponent(name)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
        },
      ),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: kapsoQueryKey.templates() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useDeleteKapsoTemplate = (
  options?: UseMutationOptions<{ deleted: boolean; name: string }, FetchError, string>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      sdk.client.fetch<{ deleted: boolean; name: string }>(
        `/admin/kapso/templates/${encodeURIComponent(name)}`,
        { method: 'DELETE' },
      ),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: kapsoQueryKey.templates() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useKapsoBindings = (
  options?: UseQueryOptions<
    KapsoBindingsResponse,
    FetchError,
    KapsoBindingsResponse,
    QueryKey
  >,
) =>
  useQuery({
    queryKey: kapsoQueryKey.bindings(),
    queryFn: async () =>
      sdk.client.fetch<KapsoBindingsResponse>('/admin/kapso/bindings', {
        method: 'GET',
      }),
    ...options,
  });

export const useSaveKapsoBinding = (
  options?: UseMutationOptions<KapsoBindingsResponse, FetchError, SaveKapsoBinding>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveKapsoBinding) =>
      sdk.client.fetch<KapsoBindingsResponse>('/admin/kapso/bindings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: kapsoQueryKey.bindings() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useKapsoFloatingButton = (
  options?: UseQueryOptions<
    KapsoFloatingButtonResponse,
    FetchError,
    KapsoFloatingButtonResponse,
    QueryKey
  >,
) =>
  useQuery({
    queryKey: kapsoQueryKey.floatingButton(),
    queryFn: async () =>
      sdk.client.fetch<KapsoFloatingButtonResponse>('/admin/kapso/floating-button', {
        method: 'GET',
      }),
    ...options,
  });

export const useUpdateKapsoFloatingButton = (
  options?: UseMutationOptions<
    KapsoFloatingButtonResponse,
    FetchError,
    UpdateKapsoFloatingButton
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateKapsoFloatingButton) =>
      sdk.client.fetch<KapsoFloatingButtonResponse>('/admin/kapso/floating-button', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData(kapsoQueryKey.floatingButton(), data);
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useDeleteKapsoBinding = (
  options?: UseMutationOptions<
    { deleted: boolean; key: string },
    FetchError,
    string
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      sdk.client.fetch<{ deleted: boolean; key: string }>(
        `/admin/kapso/bindings/${encodeURIComponent(key)}`,
        { method: 'DELETE' },
      ),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: kapsoQueryKey.bindings() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

// ─── Canales de venta que atiende el bot ──────────────────────────────────────

export interface KapsoBotChannelsResponse {
  bot_channels: { sales_channel_ids: string[] };
  channels: Array<{ id: string; name: string; is_disabled: boolean }>;
  /** Canal que se usa HOY si la lista está vacía (la env vieja). */
  env_fallback: string | null;
  configured: boolean;
  /** Ids que se descartaron por no existir (sólo en la respuesta del POST). */
  dropped?: string[];
}

export const useKapsoBotChannels = (
  options?: UseQueryOptions<
    KapsoBotChannelsResponse,
    FetchError,
    KapsoBotChannelsResponse,
    QueryKey
  >,
) =>
  useQuery({
    queryKey: kapsoQueryKey.botChannels(),
    queryFn: async () =>
      sdk.client.fetch<KapsoBotChannelsResponse>('/admin/kapso/bot-channels', {
        method: 'GET',
      }),
    ...options,
  });

export const useUpdateKapsoBotChannels = (
  options?: UseMutationOptions<
    KapsoBotChannelsResponse,
    FetchError,
    { sales_channel_ids: string[] }
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { sales_channel_ids: string[] }) =>
      sdk.client.fetch<KapsoBotChannelsResponse>('/admin/kapso/bot-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }),
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData(kapsoQueryKey.botChannels(), data);
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};
