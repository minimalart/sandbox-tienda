import {
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { FetchError } from '@medusajs/js-sdk';
import { sdk } from '../../lib/client';
import { appSettingsSiteHeaders as siteHeaders } from '../../lib/app-settings-scope';

/**
 * Ajustes de aplicación (`site_setting`, por tienda).
 *
 * La respuesta trae SÓLO estado. Los descriptores (label, tipo, ayuda,
 * opciones) los importa el bundle del admin directo de
 * `modules/app-settings/descriptors`, así que no viajan por la red.
 *
 * La TIENDA no se manda desde acá: viaja en el header `x-site-id` que pone el
 * cliente del admin para todo `/admin/*`. El backend devuelve en `site_id` la
 * capa que efectivamente leyó y va a escribir, que es lo que hay que mostrar.
 */

/**
 * De dónde sale el valor efectivo. Espeja `modules/app-settings/precedence.ts`;
 * si se agrega un miembro allá, los `Record<SettingSource, …>` de la UI dejan de
 * compilar (en el build de Vite: `src/admin` está fuera del `tsc` del backend).
 *
 * `'site'` y `'global'` son lo que antes era un solo `'db'`. `'off'` es nuevo y
 * NO es lo mismo que `'unset'`: `off` significa "tienda secundaria que no declaró
 * este valor, y por eso está apagado a propósito" —hay global y env cargados y se
 * ignoran—; `unset` significa "no hay valor en ninguna capa". Se arreglan de
 * formas distintas, así que se muestran distinto.
 */
export type SettingSource = 'site' | 'global' | 'env' | 'default' | 'off' | 'unset';

export interface AppSettingState {
  namespace: string;
  key: string;
  /** De dónde sale el valor que el backend está USANDO ahora mismo. */
  source: SettingSource;
  /**
   * Hay entrada en la capa que ESTA pantalla edita. Con una tienda activa es la
   * fila de esa tienda: un valor heredado de la global da `false`, que es la
   * señal de "esta tienda todavía sigue a la instancia".
   */
  is_set: boolean;
  /** Siempre `null` para secretos. */
  value: unknown;
  /** `••••1234`. Sólo secretos guardados y descifrables. */
  preview?: string | null;
  /** `false` si rotó la clave de cifrado. Hay que reingresar el valor. */
  decryptable?: boolean;
  env_present: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

export interface AdminAppSettingsResponse {
  settings: AppSettingState[];
  /** Capa leída y editada. `null` = la global de la instancia. */
  site_id: string | null;
  /**
   * Cuándo arrancó el proceso que respondió. Ya NO viene con un `boot_stale` ni con
   * un `restart_required`: todo ajuste gestionable desde el admin aplica al
   * instante, porque el tier `'boot'` —que prometía lo contrario sobre una lectura
   * que `medusa-config.ts` nunca hizo— dejó de existir.
   */
  process_started_at: string;
  /** La tienda forkeó este namespace por primera vez: su fila se creó copiando la global. */
  seeded_from_global?: boolean;
}

export interface UpdateAppSettingsInput {
  namespace: string;
  /** PATCH: lo ausente no se toca. Un secreto en `''` se ignora. */
  values?: Record<string, unknown>;
  /** Borrado explícito por nombre. */
  unset?: string[];
}

/**
 * La tienda entra en la KEY, no sólo en el header.
 *
 * El site viaja por `x-site-id`, así que react-query no lo ve: con una key sin
 * tienda, cambiar de tienda devolvía el cache de la anterior y la pantalla
 * mostraba la configuración de otra. `null` es la capa global, y es un valor
 * distinto de "todavía no sé", así que se distingue con `?? 'global'`.
 */
export const appSettingsQueryKey = (namespace?: string, siteId?: string | null) => [
  'admin-app-settings',
  namespace ?? 'all',
  siteId ?? 'global',
];

/**
 * El header POR LLAMADA, además del global.
 *
 * `lib/client.ts` resuelve `globalHeaders` UNA sola vez al iniciar el módulo,
 * porque su premisa es que cambiar de tienda recarga la página. Las pantallas de
 * ajustes cambian en caliente, así que ese header queda viejo y hay que pisarlo
 * en cada request. Sin esto, un guardado después de cambiar de tienda escribe en
 * la tienda anterior.
 */

export const useAppSettings = (
  namespace?: string,
  siteId?: string | null,
  // `queryKey`/`queryFn` los pone este hook: dejarlos sobreescribibles haría que
  // un caller pudiera romper la invalidación cruzada con el buscador central.
  options?: Omit<
    UseQueryOptions<AdminAppSettingsResponse, FetchError, AdminAppSettingsResponse, QueryKey>,
    'queryKey' | 'queryFn'
  >
) =>
  useQuery({
    queryKey: appSettingsQueryKey(namespace, siteId),
    queryFn: () =>
      sdk.client.fetch<AdminAppSettingsResponse>('/admin/app-settings', {
        method: 'GET',
        query: namespace ? { namespace } : undefined,
        headers: siteHeaders(siteId),
      }),
    ...options,
  });

/**
 * El error del POST, con el BODY del 400 adentro.
 *
 * El `FetchError` del js-sdk se queda sólo con `message`, `statusText` y `status`
 * (`normalizeResponse` en `@medusajs/js-sdk/dist/client.js`): el `errors` por
 * campo que devuelve `buildWritePlan` se perdía en el camino, `fieldErrorsFrom`
 * devolvía `{}` siempre y la card mostraba el toast genérico "Hay ajustes
 * inválidos" sin pintar en rojo el campo culpable. Por eso el guardado va por
 * `fetch` nativo y no por el SDK.
 */
export class AppSettingsRequestError extends Error {
  readonly status: number;
  readonly response: { status: number; data: unknown };

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'AppSettingsRequestError';
    this.status = status;
    this.response = { status, data };
  }
}

export const useUpdateAppSettings = (
  siteId?: string | null,
  options?: UseMutationOptions<AdminAppSettingsResponse, Error, UpdateAppSettingsInput>
) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async (data: UpdateAppSettingsInput) => {
      const res = await fetch('/admin/app-settings', {
        method: 'POST',
        // La sesión del admin va por cookie: sin esto el POST sale anónimo.
        credentials: 'include',
        // El `x-site-id` explícito es lo que hace seguro el cambio de tienda sin
        // recarga: sin él, guardar después de cambiar escribiría en la anterior.
        headers: { 'Content-Type': 'application/json', ...siteHeaders(siteId) },
        body: JSON.stringify(data),
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        throw new AppSettingsRequestError(body?.message ?? res.statusText, res.status, body);
      }
      return body as unknown as AdminAppSettingsResponse;
    },
    onSuccess: (...args) => {
      // Invalida el scope del namespace Y el global: guardar desde la card de
      // una extensión tiene que actualizar también el buscador central, que
      // consulta sin namespace.
      queryClient.invalidateQueries({ queryKey: ['admin-app-settings'] });
      options?.onSuccess?.(...args);
    },
  });
};

/**
 * Errores por campo que devuelve el 400 (`{ message, errors: { KEY: '...' } }`).
 * Lee `response.data`, que es lo que `AppSettingsRequestError` conserva del body;
 * con cualquier otro error (red, SDK) devuelve `{}` y el formulario cae al
 * `message`. Se normaliza acá una sola vez en vez de en cada formulario.
 */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  const body = (error as { response?: { data?: unknown } } | undefined)?.response?.data;
  const errors = (body as { errors?: unknown } | undefined)?.errors;
  if (errors && typeof errors === 'object') return errors as Record<string, string>;
  return {};
}
