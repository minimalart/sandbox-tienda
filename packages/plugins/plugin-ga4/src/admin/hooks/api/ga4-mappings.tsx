import {
  QueryKey,
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query';

/**
 * En el plugin no podemos importar `sdk` desde `../../lib/client` (vive en el
 * host). Reemplazamos las llamadas a `sdk.client.fetch<T>(url, opts)` con un
 * helper equivalente sobre `fetch()` global que incluye credenciales de
 * sesión — el admin corre en el mismo origin que el backend.
 */
export class FetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'FetchError';
  }
}

type FetchOpts = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

async function adminFetch<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new FetchError(`${res.status} ${res.statusText}`, res.status);
  }
  return res.json() as Promise<T>;
}

const sdk = {
  client: {
    fetch: adminFetch,
  },
};

/**
 * Inline del `queryKeysFactory` del host, para no depender del hook homónimo
 * — el plugin no puede importar de `apps/backend/src/admin/lib`. Tipado con
 * `unknown[]` a propósito: el tipo variádico del host dispara TS2589 al
 * anidarse en `useQueryOptions`, y las keys de react-query igual se comparan
 * estructuralmente en runtime.
 */
type QueryKeys = {
  all: readonly unknown[];
  lists: () => readonly unknown[];
  list: (query?: unknown) => readonly unknown[];
  details: () => readonly unknown[];
  detail: (id: string, query?: unknown) => readonly unknown[];
};

function queryKeysFactory(globalKey: string): QueryKeys {
  const factory: QueryKeys = {
    all: [globalKey],
    lists: () => [...factory.all, 'list'],
    list: (query?: unknown) => [...factory.lists(), { query }],
    details: () => [...factory.all, 'detail'],
    detail: (id: string, query?: unknown) => [...factory.details(), id, { query }],
  };
  return factory;
}

export interface Ga4ParamMapping {
  ga4_param: string;
  source_path?: string;
  static_value?: string;
}

export interface Ga4Mapping {
  id: string;
  medusa_event: string;
  ga4_event_name: string;
  is_active: boolean;
  description?: string;
  param_mappings?: Ga4ParamMapping[];
  metadata?: Record<string, unknown>;
}

export type Ga4EventCategory = 'recomendados' | 'b2b';

export interface Ga4SupportedEvent {
  medusa_event: string;
  category: Ga4EventCategory;
  suggested_ga4: string;
  params: string[];
}

export interface AdminGa4MappingsResponse {
  ga4_mappings: Ga4Mapping[];
  count: number;
  offset: number;
  limit: number;
}

export interface AdminGa4MappingResponse {
  ga4_mapping: Ga4Mapping;
}

export interface AdminGa4DeleteResponse {
  id: string;
  deleted: true;
}

export type Ga4ManagedSource = 'plugin' | 'storefront';

export interface Ga4ManagedEvent {
  ga4_event: string;
  source: Ga4ManagedSource;
}

export interface AdminGa4SupportedEventsResponse {
  events: Ga4SupportedEvent[];
  categories: Ga4EventCategory[];
  managed: Ga4ManagedEvent[];
}

export interface AdminCreateGa4Mapping {
  medusa_event: string;
  ga4_event_name: string;
  is_active?: boolean;
  description?: string;
  param_mappings?: Ga4ParamMapping[];
  metadata?: Record<string, unknown>;
}

export interface AdminUpdateGa4Mapping {
  medusa_event?: string;
  ga4_event_name?: string;
  is_active?: boolean;
  description?: string;
  param_mappings?: Ga4ParamMapping[];
  metadata?: Record<string, unknown>;
}

export type Ga4BuiltinKey =
  | 'purchase'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'add_shipping_info'
  | 'add_payment_info';

export interface Ga4Builtin {
  builtin_key: Ga4BuiltinKey;
  trigger_event: string;
  default_ga4_event: string;
  category: Ga4EventCategory;
  is_active: boolean;
  ga4_event_name: string;
  hidden: boolean;
}

export interface AdminGa4BuiltinsResponse {
  builtins: Ga4Builtin[];
}

export interface AdminGa4BuiltinResponse {
  builtin: Ga4Builtin;
}

export interface AdminUpdateGa4Builtin {
  is_active?: boolean;
  ga4_event_name?: string;
  hidden?: boolean;
}

export interface Ga4Config {
  measurement_id: string | null;
  gtm_id: string | null;
  api_secret_set: boolean;
  debug: boolean;
}

export interface AdminUpdateGa4Config {
  measurement_id?: string | null;
  gtm_id?: string | null;
  debug?: boolean;
  // Solo se actualiza si viene un string no vacío; omitirlo (o mandar '')
  // conserva el secreto ya guardado. Nunca se devuelve en el GET.
  api_secret?: string;
}

export interface Ga4ValidationMessage {
  fieldPath?: string;
  description?: string;
  validationCode?: string;
}

export interface Ga4ConfigTestResponse {
  valid: boolean;
  configured: boolean;
  event_name?: string;
  status?: number;
  validation_messages: Ga4ValidationMessage[];
  message?: string;
}

export const ga4MappingQueryKey = queryKeysFactory('ga4-mapping');
export const ga4SupportedEventsQueryKey = queryKeysFactory('ga4-supported-events');
export const ga4BuiltinQueryKey = queryKeysFactory('ga4-builtin');
export const ga4ConfigQueryKey = queryKeysFactory('ga4-config');

export const useGa4Mappings = (
  query?: Record<string, any>,
  options?: Omit<
    UseQueryOptions<AdminGa4MappingsResponse, FetchError, AdminGa4MappingsResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
) => {
  const filterQuery = new URLSearchParams(query).toString();

  const fetchMappings = async () =>
    sdk.client.fetch<AdminGa4MappingsResponse>(
      `/admin/ga4-mappings${filterQuery ? `?${filterQuery}` : ''}`,
      {
        method: 'GET',
      }
    );

  return useQuery({
    queryKey: ga4MappingQueryKey.list(query),
    queryFn: fetchMappings,
    ...options,
  });
};

export const useGa4Mapping = (
  id: string,
  query?: Record<string, any>,
  options?: Omit<
    UseQueryOptions<AdminGa4MappingResponse, FetchError, AdminGa4MappingResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
) => {
  const filterQuery = new URLSearchParams(query).toString();

  const fetchMapping = async () =>
    sdk.client.fetch<AdminGa4MappingResponse>(
      `/admin/ga4-mappings/${id}${filterQuery ? `?${filterQuery}` : ''}`,
      {
        method: 'GET',
      }
    );

  return useQuery({
    queryKey: ga4MappingQueryKey.detail(id),
    queryFn: fetchMapping,
    enabled: !!id,
    ...options,
  });
};

export const useCreateGa4Mapping = (
  options?: UseMutationOptions<AdminGa4MappingResponse, FetchError, AdminCreateGa4Mapping>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mapping: AdminCreateGa4Mapping) =>
      sdk.client.fetch<AdminGa4MappingResponse>('/admin/ga4-mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: mapping,
      }),
    // `...options` va ANTES del onSuccess para que el wrapper (con la
    // invalidación) gane y llame él mismo al onSuccess del caller.
    ...options,
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: ga4MappingQueryKey.lists(),
      });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useUpdateGa4Mapping = (
  id: string,
  options?: UseMutationOptions<AdminGa4MappingResponse, FetchError, AdminUpdateGa4Mapping>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mapping: AdminUpdateGa4Mapping) =>
      sdk.client.fetch<AdminGa4MappingResponse>(`/admin/ga4-mappings/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: mapping,
      }),
    ...options,
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: ga4MappingQueryKey.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: ga4MappingQueryKey.detail(id),
      });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useDeleteGa4Mapping = (
  id: string,
  options?: UseMutationOptions<AdminGa4DeleteResponse, FetchError>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<AdminGa4DeleteResponse>(`/admin/ga4-mappings/${id}`, {
        method: 'DELETE',
      }),
    ...options,
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: ga4MappingQueryKey.lists(),
      });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useSupportedEvents = (
  options?: Omit<
    UseQueryOptions<
      AdminGa4SupportedEventsResponse,
      FetchError,
      AdminGa4SupportedEventsResponse,
      QueryKey
    >,
    'queryKey' | 'queryFn'
  >
) => {
  const fetchEvents = async () =>
    sdk.client.fetch<AdminGa4SupportedEventsResponse>('/admin/ga4-mappings/events', {
      method: 'GET',
    });

  return useQuery({
    queryKey: ga4SupportedEventsQueryKey.lists(),
    queryFn: fetchEvents,
    ...options,
  });
};

export const useGa4Builtins = (
  options?: Omit<
    UseQueryOptions<AdminGa4BuiltinsResponse, FetchError, AdminGa4BuiltinsResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
) => {
  const fetchBuiltins = async () =>
    sdk.client.fetch<AdminGa4BuiltinsResponse>('/admin/ga4-builtins', {
      method: 'GET',
    });

  return useQuery({
    queryKey: ga4BuiltinQueryKey.lists(),
    queryFn: fetchBuiltins,
    ...options,
  });
};

export const useUpdateGa4Builtin = (
  builtinKey: string,
  options?: UseMutationOptions<AdminGa4BuiltinResponse, FetchError, AdminUpdateGa4Builtin>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: AdminUpdateGa4Builtin) =>
      sdk.client.fetch<AdminGa4BuiltinResponse>(`/admin/ga4-builtins/${builtinKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: patch,
      }),
    ...options,
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: ga4BuiltinQueryKey.lists(),
      });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useGa4Config = (
  options?: Omit<
    UseQueryOptions<Ga4Config, FetchError, Ga4Config, QueryKey>,
    'queryKey' | 'queryFn'
  >
) => {
  const fetchConfig = async () =>
    sdk.client.fetch<Ga4Config>('/admin/ga4-config', { method: 'GET' });

  return useQuery({
    queryKey: ga4ConfigQueryKey.lists(),
    queryFn: fetchConfig,
    ...options,
  });
};

export const useTestGa4Config = (
  options?: UseMutationOptions<Ga4ConfigTestResponse, FetchError, void>
) =>
  useMutation({
    mutationFn: () =>
      sdk.client.fetch<Ga4ConfigTestResponse>('/admin/ga4-config/test', {
        method: 'POST',
      }),
    ...options,
  });

export const useUpdateGa4Config = (
  options?: UseMutationOptions<Ga4Config, FetchError, AdminUpdateGa4Config>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: AdminUpdateGa4Config) =>
      sdk.client.fetch<Ga4Config>('/admin/ga4-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: config,
      }),
    ...options,
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: ga4ConfigQueryKey.lists(),
      });
      options?.onSuccess?.(data, variables, context);
    },
  });
};
