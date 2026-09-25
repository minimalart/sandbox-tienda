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
import { getActiveSiteId, siteHeader, siteScopedKey } from '../../lib/active-site';

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
  /**
   * LA TIENDA VA EN LA KEY. El `x-site-id` viaja por header y react-query no lo ve,
   * así que con una key constante el cache de la tienda A se sirve estando parado en
   * la B — y acá lo que se muestra es un TELÉFONO: el operador vería el número de otro
   * negocio y lo guardaría creyendo que es el suyo.
   */
  floatingButton: () => siteScopedKey([...kapsoQueryKey.all, 'floating-button'], getActiveSiteId()),
  botChannels: () => [...kapsoQueryKey.all, 'bot-channels'] as const,
  /**
   * La tienda VA en la key, por el mismo motivo que el botón flotante: acá lo que
   * se muestra es si el bot contesta. Servir el cache de la tienda A estando parado
   * en la B le diría al operador que apagó un bot que sigue atendiendo.
   */
  botSwitch: () => siteScopedKey([...kapsoQueryKey.all, 'bot-switch'], getActiveSiteId()),
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

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ `...options` VA PRIMERO EN TODA MUTACIÓN DE ESTE ARCHIVO. No es estilo.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * `useMutation({ onSuccess: mio, ...options })` es un objeto literal: si el que
 * llama pasa su propio `onSuccess` —y todas las cards lo pasan, aunque sea para un
 * toast— el spread PISA el nuestro. El `setQueryData` / `invalidateQueries` que
 * refresca la pantalla no corre nunca, y como la mutación igual devuelve 200 y el
 * toast igual sale, no parece un error: parece que el backend no guardó.
 *
 * Así se veía el bug real (interruptor del bot, 2026-09-22): apretabas el switch, el
 * toast decía "listo", el valor quedaba guardado en la base, y la pantalla seguía
 * mostrando el estado anterior hasta recargar. En las cards que además tienen estado
 * local —el botón flotante, los canales— el mismo defecto está TAPADO, porque lo que
 * ves es lo que escribiste, no lo que volvió del server.
 *
 * Con `...options` primero, el que llama sigue pudiendo pasar `onError`, `onSettled`
 * o lo que quiera, y nuestro `onSuccess` gana y lo invoca al final.
 */
export const useCreateKapsoTemplate = (
  options?: UseMutationOptions<
    { template: KapsoTemplate },
    FetchError,
    CreateKapsoTemplate
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
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
    ...options,
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
  });
};

export const useDeleteKapsoTemplate = (
  options?: UseMutationOptions<{ deleted: boolean; name: string }, FetchError, string>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: (name: string) =>
      sdk.client.fetch<{ deleted: boolean; name: string }>(
        `/admin/kapso/templates/${encodeURIComponent(name)}`,
        { method: 'DELETE' },
      ),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: kapsoQueryKey.templates() });
      options?.onSuccess?.(data, variables, context);
    },
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
    ...options,
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
        /**
         * El header POR LLAMADA, además del global. `lib/client.ts` resuelve
         * `globalHeaders` UNA sola vez al construirse, así que si la card cambia de
         * tienda sin recargar, ese header queda congelado en la que estaba activa
         * cuando cargó el bundle — y se guardaría el teléfono en la tienda anterior.
         */
        headers: siteHeader(),
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
    ...options,
    mutationFn: (body: UpdateKapsoFloatingButton) =>
      sdk.client.fetch<KapsoFloatingButtonResponse>('/admin/kapso/floating-button', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...siteHeader() },
        body,
      }),
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData(kapsoQueryKey.floatingButton(), data);
      options?.onSuccess?.(data, variables, context);
    },
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
    ...options,
    mutationFn: (key: string) =>
      sdk.client.fetch<{ deleted: boolean; key: string }>(
        `/admin/kapso/bindings/${encodeURIComponent(key)}`,
        { method: 'DELETE' },
      ),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: kapsoQueryKey.bindings() });
      options?.onSuccess?.(data, variables, context);
    },
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
    ...options,
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
  });
};

// ─── El interruptor del bot ───────────────────────────────────────────────────

/**
 * Si el bot contesta en esta tienda, y qué recorrido está publicado.
 *
 * Las dos cosas juntas a propósito: son las DOS palancas del mismo número y
 * confundirlas sale caro. Apagar el bot deja el recorrido publicado (vuelve a
 * atender en cuanto se prenda), y despublicar el recorrido NO apaga el bot —el
 * turno cae al router y al agente, que siguen contestando.
 */
export interface KapsoBotSwitchResponse {
  bot_switch: { enabled: boolean; note: string | null };
  active_flow: { id: string; name: string | null; version: number } | null;
  /** Ámbito al que escribe la pantalla: `null` = todas las tiendas. */
  site_id: string | null;
}

export const useKapsoBotSwitch = (
  options?: UseQueryOptions<KapsoBotSwitchResponse, FetchError, KapsoBotSwitchResponse, QueryKey>,
) =>
  useQuery({
    queryKey: kapsoQueryKey.botSwitch(),
    queryFn: async () =>
      sdk.client.fetch<KapsoBotSwitchResponse>('/admin/kapso/bot-switch', {
        method: 'GET',
        /**
         * El header POR LLAMADA, además del global: `lib/client.ts` resuelve
         * `globalHeaders` una sola vez al construirse, así que cambiar de tienda sin
         * recargar dejaría este GET leyendo el interruptor de la tienda anterior.
         */
        headers: siteHeader(),
      }),
    ...options,
  });

export const useUpdateKapsoBotSwitch = (
  options?: UseMutationOptions<
    KapsoBotSwitchResponse,
    FetchError,
    { enabled: boolean; note?: string | null }
  >,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: (body: { enabled: boolean; note?: string | null }) =>
      sdk.client.fetch<KapsoBotSwitchResponse>('/admin/kapso/bot-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...siteHeader() },
        body,
      }),
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData(kapsoQueryKey.botSwitch(), data);
      options?.onSuccess?.(data, variables, context);
    },
  });
};
