import { FetchError } from '@medusajs/js-sdk';
import {
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { sdk } from '../../lib/client';

/**
 * Credenciales de terceros POR TIENDA — cliente de `/admin/site-credentials`.
 *
 * Los tipos de acá son un ESPEJO del contrato de `api/admin/site-credentials/route.ts`,
 * no un import: `route.ts` importa `MedusaRequest`/`MedusaResponse` y el bundle del
 * admin no puede arrastrar el runtime de `@medusajs/framework/http`. Es la misma razón
 * por la que la ruta tiene sus schemas en un módulo aparte.
 *
 * Lo que NO está en estos tipos es tan importante como lo que sí: no hay ningún campo
 * que pueda contener un valor de credencial. Del servidor sólo bajan NOMBRES de claves
 * (`set_keys`) y flags. Si algún día aparece acá un `value`, el bug está en la ruta.
 *
 * La tienda SÍ viaja en la query key, y el header va POR LLAMADA — al revés que el
 * resto del admin, que se apoya en `globalHeaders` y en la recarga. Es lo que habilita
 * que `settings/site-credentials` cambie de tienda en caliente
 * (`<SiteScopeBar reloadOnChange={false} />`); el porqué está en el comentario de
 * `siteHeaders` más abajo y en la nota grande de `admin/lib/active-site.ts`.
 */

/** Una clave de una integración, tal como la declara `api/admin/site-credentials/catalog.ts`. */
export type SiteCredentialKeySpec = {
  key: string;
  label: string;
  /** Sólo hint de UI (input type=password). El GET nunca devuelve valores. */
  secret: boolean;
  help?: string;
};

/** De dónde salen las credenciales que se van a usar de verdad en esta tienda. */
export type SiteCredentialSource = 'site' | 'env' | 'none';

export type SiteCredentialIntegration = {
  /** El string exacto que el provider le pasa a `readSiteCredentialsViaSql`. */
  integration: string;
  label: string;
  keys: SiteCredentialKeySpec[];
  /** ¿Esta tienda tiene fila propia? Es `true` incluso si el blob no descifra. */
  is_set: boolean;
  /** NOMBRES de las claves guardadas. Vacío si `decryptable` es `false`. */
  set_keys: string[];
  /** `false` = hay fila y el blob no se puede descifrar (rotó la clave de cifrado). */
  decryptable: boolean;
  effective_source: SiteCredentialSource;
  env_available: boolean;
  updated_at: string | null;
  /** Archivo que consume estas credenciales, o `null` si todavía no hay lector. */
  reader: string | null;
  blocked_reason: string | null;
  /** `false` = guardar no tendría efecto; el POST la rechaza. */
  writable: boolean;
  /**
   * Sólo en la vista SIN tienda activa: en cuántas tiendas hay algo cargado.
   * Es lo único honesto que se puede decir desde "todas las tiendas".
   */
  sites_with_credentials?: number;
};

/** Fila de `site_credential` que el catálogo no conoce (INSERT a mano, o extensión desinstalada). */
export type UnknownSiteCredential = {
  integration: string;
  set_keys: string[];
  decryptable: boolean;
  updated_at: string | null;
};

/**
 * El `status` de `SiteResolution` (`lib/multistore/types.ts`) tal como lo espeja la
 * ruta. `site` es el único que habilita escritura; los demás son motivos DISTINTOS de
 * por qué no hay tienda, y la UI los tiene que separar.
 */
export type SiteCredentialsScope =
  | 'site'
  | 'singleSite'
  | 'allSites'
  | 'registryAbsent'
  | 'unknownSite';

export type AdminSiteCredentialsResponse = {
  site: { id: string; slug: string; name: string } | null;
  scope: SiteCredentialsScope;
  /** Sólo cuando `site` es `null`: por qué no se puede editar nada. */
  message?: string;
  integrations: SiteCredentialIntegration[];
  /** Sólo con tienda activa. */
  unknown_integrations?: UnknownSiteCredential[];
};

export type UpsertSiteCredentialsInput = {
  integration: string;
  /**
   * Claves a guardar. Un string vacío lo IGNORA el servidor: significa "no toqué el
   * campo enmascarado". Para borrar está `unset`.
   */
  set?: Record<string, string>;
  /** Claves a borrar, por NOMBRE. Nunca viaja un valor de vuelta al servidor. */
  unset?: string[];
  /**
   * Sólo si el blob guardado no descifra. Confirma que se arranca de cero: las otras
   * claves de esa integración se pierden porque ya eran irrecuperables. Sin esto la
   * ruta corta con 409 en vez de mergear sobre `{}` y perderlas en silencio.
   */
  replace_undecryptable?: boolean;
};

export type UpsertSiteCredentialsResponse = {
  result: 'saved' | 'cleared' | 'unchanged';
  written: string[];
  removed: string[];
  integration: SiteCredentialIntegration;
};

export type DeleteSiteCredentialsResponse = {
  result: 'deleted' | 'not_found';
  integration: SiteCredentialIntegration;
};

export const SITE_CREDENTIALS_QUERY_KEY: QueryKey = ['admin-site-credentials'];

/**
 * La tienda entra en la KEY y viaja como header POR LLAMADA.
 *
 * El site va por `x-site-id`, así que react-query no lo ve: con una key constante,
 * cambiar de tienda sin recargar devolvía las credenciales de la anterior. Y
 * `lib/client.ts` resuelve `globalHeaders` UNA vez al iniciar el módulo, así que sin
 * recarga ese header queda viejo — sin el header explícito, un guardado después de
 * cambiar de tienda escribiría la credencial en la tienda equivocada. Para secretos
 * eso no es un bug de UI: es cargarle la cuenta de un comercio a otro.
 */
const siteHeaders = (siteId?: string | null): Record<string, string> =>
  siteId ? { 'x-site-id': siteId } : {};

const credentialsQueryKey = (siteId?: string | null) => [
  ...SITE_CREDENTIALS_QUERY_KEY,
  siteId ?? 'global',
];

export const useSiteCredentials = (
  siteId?: string | null,
  options?: UseQueryOptions<
    AdminSiteCredentialsResponse,
    FetchError,
    AdminSiteCredentialsResponse,
    QueryKey
  >,
) =>
  useQuery({
    queryKey: credentialsQueryKey(siteId),
    queryFn: () =>
      sdk.client.fetch<AdminSiteCredentialsResponse>('/admin/site-credentials', {
        method: 'GET',
        headers: siteHeaders(siteId),
      }),
    // SIN CACHE, a diferencia del resto de los hooks del admin. Las tres opciones
    // son deliberadas y las tres hacen falta juntas:
    //
    //   `staleTime: 0`      — lo cacheado nunca se considera fresco.
    //   `refetchOnMount`    — al remontar (y remonta en CADA cambio de tienda, por
    //                         el `key={activeId}` de la página) sale a la red.
    //   `gcTime: 0`         — y además se TIRA. Sin esto, react-query devuelve lo
    //                         viejo mientras revalida: `isPending` sale en false,
    //                         no aparece el esqueleto, y durante ese instante la
    //                         pantalla muestra las credenciales de la tienda
    //                         ANTERIOR bajo el título de la nueva.
    //
    // Ese último punto es el motivo real. En cualquier otra pantalla mostrar datos
    // viejos un instante es un detalle de UX; acá el operador puede leer "SendGrid:
    // configurado" que en realidad es de otra tienda y decidir no cargar nada. La
    // pantalla es de bajo tráfico y la respuesta es chica: el viaje de más no se
    // siente, y la ambigüedad sí.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    ...options,
  });

/**
 * Upsert de `(tienda activa, integración)`. MERGEA sobre lo guardado: mandar una sola
 * clave no pisa las demás.
 *
 * No recibe `site_id` a propósito. La tienda la pone el header y sin tienda la ruta
 * responde 400 — el default silencioso a "la global" es el bug que convierte "cargué
 * la cuenta de la tienda Norte" en "le cambié la cuenta a todas".
 */
export const useUpdateSiteCredentials = (
  siteId?: string | null,
  options?: UseMutationOptions<UpsertSiteCredentialsResponse, FetchError, UpsertSiteCredentialsInput>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: (data: UpsertSiteCredentialsInput) =>
      sdk.client.fetch<UpsertSiteCredentialsResponse>('/admin/site-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...siteHeaders(siteId) },
        body: data,
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: SITE_CREDENTIALS_QUERY_KEY });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

/**
 * Desconecta la cuenta propia de la tienda: la integración vuelve a heredar las
 * credenciales del entorno (o se queda sin ninguna).
 *
 * Distinto de `unset`, que quita claves sueltas. Va por query param y no en el body
 * porque un DELETE con body no sobrevive a todos los clientes HTTP.
 */
export const useDeleteSiteCredentials = (
  siteId?: string | null,
  options?: UseMutationOptions<DeleteSiteCredentialsResponse, FetchError, string>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: (integration: string) =>
      sdk.client.fetch<DeleteSiteCredentialsResponse>(
        `/admin/site-credentials?integration=${encodeURIComponent(integration)}`,
        { method: 'DELETE', headers: siteHeaders(siteId) },
      ),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: SITE_CREDENTIALS_QUERY_KEY });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

/**
 * El 409 de "blob ilegible" tiene una salida concreta (`replace_undecryptable: true`),
 * así que la UI lo tiene que distinguir de un error cualquiera en vez de mostrar el
 * texto crudo y dejar al operador sin siguiente paso.
 */
export const isUndecryptableConflict = (error: unknown): boolean =>
  error instanceof FetchError && error.status === 409;

/** Mensaje del backend si lo hay; si no, el del error. Nunca un objeto en pantalla. */
export const credentialErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  return 'No se pudo completar la operación.';
};
